import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { api } from "../api"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const ROLE_OPTIONS = ["tourist", "agent", "admin"]
const SOCIAL_PROVIDERS = ["google", "apple", "facebook"]
const SSO_PROVIDERS = ["azure-ad", "okta", "auth0", "google-workspace"]

const ROLE_LANDING = {
  tourist: { route: "/recommendations", label: "Personalized recommendations and destination explorer" },
  agent: { route: "/bookings", label: "Agent booking operations and itinerary coordination" },
  admin: { route: "/analytics", label: "Admin analytics, performance, and campaign insights" },
  guest: { route: "/attractions", label: "Guest mode with limited destination browsing" },
}

const ROLE_CAPABILITIES = {
  tourist: ["bookings", "reviews", "itinerary", "profile", "notifications"],
  agent: ["bookings", "itinerary", "community", "notifications"],
  admin: ["analytics", "bookings", "notifications", "community"],
  guest: ["attractions", "map", "recommendations", "alerts"],
}

function detectDeviceName() {
  if (typeof window === "undefined") return "Web Client"
  const userAgent = window.navigator.userAgent || ""
  return userAgent.includes("Mobile") ? "Mobile Browser" : "Desktop Browser"
}

function roleLanding(role) {
  return ROLE_LANDING[role] || ROLE_LANDING.tourist
}

function capabilityLabel(key) {
  const map = {
    bookings: "Booking center",
    reviews: "Review and rating features",
    itinerary: "Trip planning",
    profile: "Profile preferences",
    notifications: "Alerts and advisories",
    community: "Community workspace",
    analytics: "Analytics dashboard",
    attractions: "Destination browser",
    map: "Interactive map",
    recommendations: "Recommendation feed",
    alerts: "Public alerts",
  }
  return map[key] || key
}

function formatDate(value) {
  if (!value) return "N/A"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function isStrongPassword(value) {
  if (!value || String(value).length < 8) return false
  const hasLetter = /[A-Za-z]/.test(value)
  const hasNumber = /\d/.test(value)
  return hasLetter && hasNumber
}

function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function Auth() {
  const navigate = useNavigate()

  const [mode, setMode] = useState("login")
  const [role, setRole] = useState("tourist")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")

  const [consent, setConsent] = useState(() => readStoredJson("tourism-consent", true))
  const [analyticsConsent, setAnalyticsConsent] = useState(() =>
    readStoredJson("tourism-analytics-consent", true),
  )
  const [mfaEnabled, setMfaEnabled] = useState(() => readStoredJson("tourism-mfa-enabled", false))
  const [mfaMethod, setMfaMethod] = useState(() => readStoredJson("tourism-mfa-method", "authenticator"))

  const [forgotEmail, setForgotEmail] = useState("")
  const [deleteConfirmation, setDeleteConfirmation] = useState("")
  const [ssoProvider, setSsoProvider] = useState("azure-ad")
  const [ssoEmail, setSsoEmail] = useState("")
  const [ssoAssertion, setSsoAssertion] = useState("")

  const [mfaChallenge, setMfaChallenge] = useState(null)
  const [mfaCode, setMfaCode] = useState("")

  const [currentUser, setCurrentUser] = useState(() => readStoredJson("tourism-auth-user", null))
  const [sessionId, setSessionId] = useState(() => readStoredJson("tourism-auth-session", ""))
  const [devices, setDevices] = useState([])

  const [submitting, setSubmitting] = useState(false)
  const [socialLoadingProvider, setSocialLoadingProvider] = useState("")
  const [ssoLoading, setSsoLoading] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const currentUserId = useMemo(() => {
    const id = Number(currentUser?.id)
    return Number.isNaN(id) ? null : id
  }, [currentUser?.id])

  const effectiveRole = currentUser?.role || role
  const landing = roleLanding(effectiveRole)
  const capabilities = ROLE_CAPABILITIES[effectiveRole] || ROLE_CAPABILITIES.tourist

  useEffect(() => {
    writeStoredJson("tourism-consent", consent)
  }, [consent])

  useEffect(() => {
    writeStoredJson("tourism-analytics-consent", analyticsConsent)
  }, [analyticsConsent])

  useEffect(() => {
    writeStoredJson("tourism-mfa-enabled", mfaEnabled)
  }, [mfaEnabled])

  useEffect(() => {
    writeStoredJson("tourism-mfa-method", mfaMethod)
  }, [mfaMethod])

  useEffect(() => {
    if (!currentUserId) {
      setDevices([])
      return
    }

    api.auth
      .sessions(currentUserId)
      .then((records) => {
        const list = (records || []).map((entry) => ({
          id: entry.id,
          name: entry.deviceName || "Web Client",
          location: entry.location || "Unknown",
          authMethod: entry.authMethod || "password",
          lastSeen: entry.lastSeen ? new Date(entry.lastSeen).toLocaleString() : "N/A",
          current: entry.id === sessionId,
        }))
        setDevices(list)
      })
      .catch(() => setDevices([]))
  }, [currentUserId, sessionId])

  const completeLogin = (result, successMessage) => {
    setCurrentUser(result.user)
    setSessionId(result.sessionId || "")
    setMfaEnabled(Boolean(result.user?.mfaEnabled))
    writeStoredJson("tourism-auth-user", result.user)
    writeStoredJson("tourism-auth-session", result.sessionId || "")
    setMessage(successMessage || result.message || "Authentication successful.")
    setError("")
    setPassword("")
    setMfaChallenge(null)
    setMfaCode("")
  }

  const handleAuthSubmit = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!email || !password) {
      setError("Email and password are required.")
      return
    }
    if (mode === "register" && !name.trim()) {
      setError("Name is required for registration.")
      return
    }
    if (mode === "register" && !isStrongPassword(password)) {
      setError("Password must be at least 8 characters and include letters and numbers.")
      return
    }
    if (!consent) {
      setError("Data consent must be accepted before authentication.")
      return
    }

    setSubmitting(true)
    try {
      if (mode === "register") {
        const user = await api.auth.register({
          username: name.trim(),
          email,
          password,
          role,
          mfaEnabled,
        })
        setCurrentUser(user)
        writeStoredJson("tourism-auth-user", user)
        setMessage(`Account created for ${user.role || role}.`)
        setPassword("")
      } else {
        const result = await api.auth.login({
          email,
          password,
          mfaMethod,
          deviceName: detectDeviceName(),
          location: "Rwanda",
        })

        if (result.challengeRequired) {
          setMfaChallenge(result)
          setMessage(`MFA challenge issued via ${result.mfaMethod}.`)
          return
        }

        completeLogin(result, `Login successful. ${landing.label}`)
      }
    } catch (requestError) {
      setError("Authentication request failed. Check credentials or try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyMfa = async () => {
    setError("")
    if (!mfaChallenge?.challengeId) {
      setError("No active MFA challenge to verify.")
      return
    }
    if (!String(mfaCode).trim()) {
      setError("Enter the MFA verification code.")
      return
    }

    try {
      const result = await api.auth.verifyMfa({
        challengeId: mfaChallenge.challengeId,
        code: String(mfaCode).trim(),
        deviceName: detectDeviceName(),
        location: "Rwanda",
      })
      completeLogin(result, "MFA verification successful. Session established.")
    } catch (requestError) {
      setError("Invalid or expired MFA code.")
    }
  }

  const handleSocialLogin = async (provider) => {
    setError("")
    setMessage("")
    setSocialLoadingProvider(provider)

    try {
      const loginEmail = (email || `${provider}.traveler@demo.local`).toLowerCase()
      const result = await api.auth.socialLogin({
        provider,
        externalToken: `demo-${provider}-${Date.now()}`,
        email: loginEmail,
        displayName: name || `${provider} traveler`,
        role,
        deviceName: detectDeviceName(),
        location: "Rwanda",
        mfaMethod,
      })

      if (result.challengeRequired) {
        setMfaChallenge(result)
        setMessage(`Social login verified. MFA challenge issued via ${result.mfaMethod}.`)
        return
      }

      completeLogin(result, `${provider.toUpperCase()} login successful.`)
    } catch (requestError) {
      setError(`Could not authenticate with ${provider}.`)
    } finally {
      setSocialLoadingProvider("")
    }
  }

  const handleSsoLogin = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!ssoEmail.trim()) {
      setError("SSO email is required.")
      return
    }
    if (!consent) {
      setError("Data consent must be accepted before SSO.")
      return
    }

    setSsoLoading(true)
    try {
      const result = await api.auth.ssoLogin({
        provider: ssoProvider,
        assertion: ssoAssertion.trim() || `demo-assertion-${Date.now()}`,
        email: ssoEmail.trim().toLowerCase(),
        displayName: name || "Corporate User",
        role,
        deviceName: detectDeviceName(),
        location: "Rwanda",
        mfaMethod,
      })

      if (result.challengeRequired) {
        setMfaChallenge(result)
        setMessage(`SSO assertion accepted. MFA challenge issued via ${result.mfaMethod}.`)
        return
      }

      completeLogin(result, "SSO sign-in successful.")
    } catch (requestError) {
      setError("SSO login failed. Verify provider settings and assertion.")
    } finally {
      setSsoLoading(false)
    }
  }

  const handlePasswordRecovery = async (event) => {
    event.preventDefault()
    setError("")
    if (!forgotEmail.trim()) {
      setError("Enter your email to recover your password.")
      return
    }

    try {
      const result = await api.auth.recover(forgotEmail)
      setMessage(result.message || "Recovery instructions queued.")
    } catch (requestError) {
      setError("Could not trigger password recovery.")
    }
  }

  const handleMfaEnabledChange = async (next) => {
    setMfaEnabled(next)
    if (!currentUserId) return
    try {
      const updated = await api.auth.updateMfa(currentUserId, next)
      setCurrentUser(updated)
      writeStoredJson("tourism-auth-user", updated)
      setMessage(`MFA ${next ? "enabled" : "disabled"} for this account.`)
    } catch (requestError) {
      setError("Could not update MFA settings.")
    }
  }

  const removeDeviceSession = async (id) => {
    try {
      await api.auth.revokeSession(id)
      if (id === sessionId) {
        setSessionId("")
        writeStoredJson("tourism-auth-session", "")
      }
      setDevices((current) => current.filter((device) => device.id !== id))
      setMessage("Session revoked.")
    } catch (requestError) {
      setError("Failed to revoke session.")
    }
  }

  const handleGuestMode = async () => {
    setError("")
    try {
      const result = await api.auth.guest()
      const guestUser = result.user || { id: "guest", username: "Guest Traveler", role: "guest" }
      setCurrentUser(guestUser)
      setSessionId("guest-session")
      writeStoredJson("tourism-auth-user", guestUser)
      writeStoredJson("tourism-auth-session", "guest-session")
      setDevices([])
      setMessage(result.message || "Guest mode enabled.")
    } catch (requestError) {
      setError("Guest mode unavailable.")
    }
  }

  const handleSignOut = () => {
    setCurrentUser(null)
    setSessionId("")
    setDevices([])
    setMfaChallenge(null)
    writeStoredJson("tourism-auth-user", null)
    writeStoredJson("tourism-auth-session", "")
    setMessage("Signed out from current device.")
  }

  const handleExportData = async () => {
    if (!currentUserId) {
      setError("Sign in with a registered account to export data.")
      return
    }

    try {
      const serverData = await api.auth.exportData(currentUserId)
      const localData = {
        consent,
        analyticsConsent,
        mfaEnabled,
        mfaMethod,
        profileSnapshot: readStoredJson(`tourism-profile-snapshot-${currentUserId}`, null),
        profileExtras: readStoredJson(`tourism-profile-extra-${currentUserId}`, null),
        bookingHistoryLocal: readStoredJson("tourism-booking-records-v3", []),
        savedDestinations: readStoredJson("tourism-destination-saved-places", []),
      }

      downloadFile(
        `tourism-user-data-${currentUserId}.json`,
        JSON.stringify({ generatedAt: new Date().toISOString(), serverData, localData }, null, 2),
        "application/json",
      )
      setMessage("User data export prepared (GDPR portability support).")
    } catch (requestError) {
      setError("Failed to export user data.")
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setError("Type DELETE to confirm account deletion.")
      return
    }
    if (!currentUserId) {
      setError("No signed-in registered account to delete.")
      return
    }

    try {
      await api.auth.deleteAccount(currentUserId)
      setCurrentUser(null)
      setSessionId("")
      setDevices([])
      writeStoredJson("tourism-auth-user", null)
      writeStoredJson("tourism-auth-session", "")
      setDeleteConfirmation("")
      setMessage("Account and related data removed.")
    } catch (requestError) {
      setError("Failed to delete account.")
    }
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <header className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Access Module</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">User Access and Authentication</h1>
          <p className="mt-2 text-sm text-cyan-50 md:text-base">
            Role-based access, secure MFA, session control, guest mode, GDPR data settings, social login, and SSO.
          </p>
          {currentUser && (
            <p className="mt-2 text-xs text-cyan-100">
              Active user: {currentUser.username} ({currentUser.role || "tourist"})
            </p>
          )}
        </header>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <section className="app-card space-y-6">
            <div className="flex flex-wrap gap-2">
              {["login", "register"].map((entryMode) => (
                <button
                  key={entryMode}
                  type="button"
                  className={`rounded px-4 py-2 text-sm font-semibold ${
                    mode === entryMode ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-700"
                  }`}
                  onClick={() => setMode(entryMode)}
                >
                  {entryMode === "login" ? "Login" : "Register"}
                </button>
              ))}
              <button type="button" onClick={handleGuestMode} className="rounded bg-cyan-600 px-4 py-2 text-sm font-semibold text-white">
                Guest mode
              </button>
              {currentUser && (
                <button type="button" onClick={handleSignOut} className="rounded bg-slate-700 px-4 py-2 text-sm font-semibold text-white">
                  Sign out
                </button>
              )}
            </div>

            <form className="space-y-4" onSubmit={handleAuthSubmit}>
              {mode === "register" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="input-control"
                    placeholder="Traveler name"
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-control"
                  placeholder="name@example.com"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-control"
                  placeholder="Password"
                />
                {mode === "register" && (
                  <p className="mt-1 text-xs text-slate-500">Minimum 8 chars, include letters and numbers.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role-based dashboard landing</label>
                <select value={role} onChange={(event) => setRole(event.target.value)} className="input-control">
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-slate-500">{roleLanding(role).label}</p>
              </div>

              <button className="btn-primary w-full" type="submit" disabled={submitting}>
                {submitting ? "Processing..." : mode === "register" ? "Create account" : "Sign in"}
              </button>
            </form>

            {!!mfaChallenge && (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4">
                <h3 className="text-sm font-bold text-amber-800">MFA verification required</h3>
                <p className="mt-1 text-xs text-amber-700">
                  Method: {mfaChallenge.mfaMethod} | Delivery target: {mfaChallenge.mfaDeliveryTarget || "registered channel"}
                </p>
                {mfaChallenge.mfaDemoCode && (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Demo code (development): {mfaChallenge.mfaDemoCode}
                  </p>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    value={mfaCode}
                    onChange={(event) => setMfaCode(event.target.value)}
                    className="input-control"
                    placeholder="Enter MFA code"
                  />
                  <button type="button" onClick={handleVerifyMfa} className="btn-primary">
                    Verify
                  </button>
                </div>
              </section>
            )}

            <section className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-semibold text-slate-700">Social login options</p>
              <div className="flex flex-wrap gap-2">
                {SOCIAL_PROVIDERS.map((provider) => (
                  <button
                    type="button"
                    key={provider}
                    className="rounded border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700"
                    onClick={() => handleSocialLogin(provider)}
                    disabled={socialLoadingProvider === provider}
                  >
                    {socialLoadingProvider === provider
                      ? `Connecting ${provider}...`
                      : `Continue with ${provider.charAt(0).toUpperCase()}${provider.slice(1)}`}
                  </button>
                ))}
              </div>
            </section>

            <form className="space-y-3 rounded border border-slate-200 p-4" onSubmit={handleSsoLogin}>
              <p className="text-sm font-semibold text-slate-700">Single sign-on (SSO)</p>
              <select value={ssoProvider} onChange={(event) => setSsoProvider(event.target.value)} className="input-control">
                {SSO_PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>
                    {provider}
                  </option>
                ))}
              </select>
              <input
                value={ssoEmail}
                onChange={(event) => setSsoEmail(event.target.value)}
                className="input-control"
                placeholder="Corporate email"
              />
              <input
                value={ssoAssertion}
                onChange={(event) => setSsoAssertion(event.target.value)}
                className="input-control"
                placeholder="SSO assertion token (optional for demo)"
              />
              <button type="submit" className="btn-secondary w-full" disabled={ssoLoading}>
                {ssoLoading ? "Processing SSO..." : "Sign in with SSO"}
              </button>
            </form>

            <form className="space-y-3 rounded border border-slate-200 p-4" onSubmit={handlePasswordRecovery}>
              <p className="text-sm font-semibold text-slate-700">Password recovery</p>
              <input
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                className="input-control"
                placeholder="Recovery email"
              />
              <button type="submit" className="rounded bg-amber-500 px-3 py-2 text-sm font-semibold text-white">
                Send recovery link
              </button>
            </form>
          </section>

          <section className="space-y-6">
            <section className="app-card">
              <h2 className="section-title text-lg">Role Access Control</h2>
              <p className="section-note">Current role landing and accessible capabilities.</p>
              <div className="mt-3 app-card-soft">
                <p className="text-sm font-semibold text-slate-700">Landing route: {landing.route}</p>
                <p className="text-xs text-slate-500">{landing.label}</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {capabilities.map((capability) => (
                  <span key={capability} className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                    {capabilityLabel(capability)}
                  </span>
                ))}
              </div>
              <button type="button" className="btn-primary mt-3 w-full" onClick={() => navigate(landing.route)}>
                Open Role Dashboard
              </button>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Two-Factor Authentication Setup</h2>
              <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" checked={mfaEnabled} onChange={(event) => handleMfaEnabledChange(event.target.checked)} />
                Enable MFA for this account
              </label>
              <select
                value={mfaMethod}
                onChange={(event) => setMfaMethod(event.target.value)}
                className="input-control mt-3"
                disabled={!mfaEnabled}
              >
                <option value="authenticator">Authenticator app</option>
                <option value="sms">SMS code</option>
                <option value="email">Email code</option>
              </select>
              <p className="mt-2 text-xs text-slate-500">Login requires second-factor verification when enabled.</p>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Session Management (Active Devices)</h2>
              <div className="mt-3 space-y-2">
                {devices.map((device) => (
                  <div key={device.id} className="app-card-soft flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{device.name}</p>
                      <p className="text-xs text-slate-500">
                        {device.location} | {device.authMethod} | {device.lastSeen}
                      </p>
                    </div>
                    {device.current ? (
                      <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Current
                      </span>
                    ) : (
                      <button type="button" className="rounded bg-rose-500 px-2 py-1 text-xs font-semibold text-white" onClick={() => removeDeviceSession(device.id)}>
                        Sign out
                      </button>
                    )}
                  </div>
                ))}
                {!devices.length && <p className="section-note">No active sessions available for this account.</p>}
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Privacy, Consent, and Data Rights</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  Data consent for personalization and booking experience
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={analyticsConsent}
                    onChange={(event) => setAnalyticsConsent(event.target.checked)}
                  />
                  Consent for analytics and service improvement
                </label>
              </div>
              <button type="button" className="btn-secondary mt-3 w-full" onClick={handleExportData}>
                Export My Data (GDPR)
              </button>
            </section>

            <section className="rounded-2xl border border-rose-300 bg-rose-50 p-6 shadow-lg">
              <h2 className="text-lg font-bold text-rose-900">Account Deletion</h2>
              <p className="mt-1 text-sm text-rose-700">Type DELETE to permanently remove this account.</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  className="w-full rounded border border-rose-300 px-3 py-2"
                  placeholder="DELETE"
                />
                <button type="button" onClick={handleDeleteAccount} className="rounded bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
                  Delete
                </button>
              </div>
            </section>
          </section>
        </div>

        {(message || error) && (
          <div className={`rounded-xl p-4 text-sm font-semibold ${error ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>
            {error || message}
          </div>
        )}
      </div>
    </div>
  )
}
