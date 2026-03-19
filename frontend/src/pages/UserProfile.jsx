import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import {
  ACCESSIBILITY_OPTIONS,
  INTEREST_OPTIONS,
  PREFERENCE_OPTIONS,
  normalizeLabel,
} from "../data/tourismData"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const LANGUAGE_OPTIONS = ["English", "French", "Kinyarwanda", "Swahili"]

const EXPERIENCE_LIBRARY = [
  {
    id: "volcano-ridge-trek",
    title: "Volcano Ridge Trek",
    city: "Musanze",
    duration: "2 days",
    description: "Guided mountain trails with wildlife tracking and sunrise views.",
    preferences: ["adventure"],
    interests: ["hiking", "wildlife", "photography"],
    budgets: ["mid-range", "luxury"],
    accessibility: ["language"],
    familyFriendly: false,
    groupFriendly: true,
  },
  {
    id: "kigali-heritage-circuit",
    title: "Kigali Heritage Circuit",
    city: "Kigali",
    duration: "1 day",
    description: "Museums, cultural storytelling, and craft district stops.",
    preferences: ["culture", "family"],
    interests: ["history", "food", "photography"],
    budgets: ["economy", "mid-range"],
    accessibility: ["mobility", "language"],
    familyFriendly: true,
    groupFriendly: true,
  },
  {
    id: "lakeside-slow-weekend",
    title: "Lakeside Slow Weekend",
    city: "Rubavu",
    duration: "2 days",
    description: "Relaxed lake experiences, sunset dining, and light activities.",
    preferences: ["relaxation", "family"],
    interests: ["food", "photography"],
    budgets: ["economy", "mid-range", "luxury"],
    accessibility: ["mobility", "dietary", "language"],
    familyFriendly: true,
    groupFriendly: true,
  },
  {
    id: "savannah-photo-safari",
    title: "Savannah Photo Safari",
    city: "Nyagatare",
    duration: "2 days",
    description: "Wildlife drives with dedicated photo windows and local guides.",
    preferences: ["adventure", "luxury"],
    interests: ["wildlife", "photography"],
    budgets: ["mid-range", "luxury"],
    accessibility: ["dietary", "language"],
    familyFriendly: true,
    groupFriendly: true,
  },
  {
    id: "city-food-nights",
    title: "City Food Nights",
    city: "Kigali",
    duration: "Evening",
    description: "Chef-led local food route through markets and modern kitchens.",
    preferences: ["culture", "relaxation"],
    interests: ["food", "history"],
    budgets: ["economy", "mid-range"],
    accessibility: ["dietary", "language"],
    familyFriendly: true,
    groupFriendly: true,
  },
]

function parseCsv(value) {
  return value ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : []
}

function toBudgetLabel(value) {
  if (value <= 33) return "economy"
  if (value <= 66) return "mid-range"
  return "luxury"
}

function budgetToSliderValue(value) {
  if (value === "economy") return 20
  if (value === "luxury") return 90
  return 55
}

function initialExtendedProfile(userId) {
  return readStoredJson(`tourism-profile-extra-${userId}`, {
    nationality: "",
    travelCompanions: 1,
    groupMembers: [],
    accessibilityNeeds: [],
    privacyShareProfile: true,
    privacyShareLocation: false,
    privacyShareCommunity: true,
    languagePreference: "English",
  })
}

function formatDate(value) {
  if (!value) return "Not available"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function scoreExperience(experience, preferences, extended) {
  const preferenceMatches = experience.preferences.filter((item) => preferences.preferences.includes(item))
  const interestMatches = experience.interests.filter((item) => preferences.interests.includes(item))
  const budgetMatch = experience.budgets.includes(preferences.budgetRange)
  const accessibilityMatches = experience.accessibility.filter((item) => extended.accessibilityNeeds.includes(item))
  const missingAccessibility = extended.accessibilityNeeds.filter((item) => !experience.accessibility.includes(item))
  const isGroupTravel = Number(extended.travelCompanions || 1) > 2

  let score = 10
  score += preferenceMatches.length * 22
  score += interestMatches.length * 14
  score += budgetMatch ? 16 : 4
  score += accessibilityMatches.length * 11
  score -= missingAccessibility.length * 8
  if (preferences.preferences.includes("family") && experience.familyFriendly) score += 12
  if (isGroupTravel && experience.groupFriendly) score += 9

  const reasons = []
  if (preferenceMatches.length) reasons.push(`${normalizeLabel(preferenceMatches[0])} style aligned`)
  if (interestMatches.length) reasons.push(`${interestMatches.length} interest tags matched`)
  if (budgetMatch) reasons.push(`${normalizeLabel(preferences.budgetRange)} budget fit`)
  if (accessibilityMatches.length) reasons.push(`${normalizeLabel(accessibilityMatches[0])} support available`)

  const matchedTags = [...new Set([...preferenceMatches, ...interestMatches])]
  if (accessibilityMatches.length) matchedTags.push("accessible")
  if (isGroupTravel && experience.groupFriendly) matchedTags.push("group")

  return {
    score: Math.max(0, Math.min(99, Math.round(score))),
    reasons,
    matchedTags,
    missingAccessibility,
  }
}

export default function UserProfile() {
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState("")
  const [preferences, setPreferences] = useState({
    interests: [],
    preferences: [],
    budgetRange: "mid-range",
    nationality: "",
  })
  const [extended, setExtended] = useState(initialExtendedProfile("new"))
  const [bookingTimeline, setBookingTimeline] = useState([])
  const [registerForm, setRegisterForm] = useState({ username: "", email: "", nationality: "", companions: 1 })
  const [groupMemberDraft, setGroupMemberDraft] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [lastSavedAt, setLastSavedAt] = useState(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.users
      .list()
      .then((data) => {
        if (cancelled) return
        const list = data.value || data || []
        setUsers(list)
        if (list.length) setSelectedUserId(String(list[0].id))
      })
      .catch(() => !cancelled && setError("Failed to load users."))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedUserId) return
    let cancelled = false
    const userId = Number(selectedUserId)
    const storedExtended = initialExtendedProfile(userId)
    const snapshot = readStoredJson(`tourism-profile-snapshot-${userId}`, null)

    setLoadingProfile(true)
    setExtended(storedExtended)
    setLastSavedAt(snapshot?.savedAt || null)
    setActiveFilter("all")

    Promise.allSettled([api.preferences.get(userId), api.bookings.list(userId)])
      .then(([prefResult, bookingResult]) => {
        if (cancelled) return

        if (prefResult.status === "fulfilled" && prefResult.value) {
          const prefData = prefResult.value
          const apiAccessibility = parseCsv(prefData.accessibility)
          setPreferences({
            interests: parseCsv(prefData.interests),
            preferences: parseCsv(prefData.preferences),
            budgetRange: prefData.budgetRange || "mid-range",
            nationality: prefData.nationality || storedExtended.nationality || "",
          })
          setExtended((current) => ({
            ...current,
            nationality: prefData.nationality || current.nationality || "",
            accessibilityNeeds: apiAccessibility.length ? apiAccessibility : current.accessibilityNeeds,
          }))
        } else {
          setPreferences({
            interests: [],
            preferences: [],
            budgetRange: "mid-range",
            nationality: storedExtended.nationality || "",
          })
        }

        if (bookingResult.status === "fulfilled") {
          const bookings = bookingResult.value.value || bookingResult.value || []
          setBookingTimeline(bookings)
        } else {
          setBookingTimeline([])
        }
      })
      .finally(() => !cancelled && setLoadingProfile(false))

    return () => {
      cancelled = true
    }
  }, [selectedUserId])

  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)),
    [selectedUserId, users],
  )

  const checklist = useMemo(
    () => [
      { label: "Traveler selected", done: Boolean(selectedUserId) },
      { label: "Nationality provided", done: Boolean(preferences.nationality || extended.nationality) },
      { label: "Preference selector completed", done: preferences.preferences.length > 0 },
      { label: "Interest tags selected", done: preferences.interests.length > 0 },
      { label: "Budget range selected", done: Boolean(preferences.budgetRange) },
      { label: "Accessibility configured", done: extended.accessibilityNeeds.length > 0 },
      { label: "Travel companions set", done: Number(extended.travelCompanions || 1) > 0 },
    ],
    [extended, preferences, selectedUserId],
  )

  const profileCompleteness = useMemo(() => {
    const complete = checklist.filter((item) => item.done).length
    return Math.round((complete / checklist.length) * 100)
  }, [checklist])

  const recommendationFilters = useMemo(() => {
    const tags = new Set(["all"])
    preferences.preferences.forEach((value) => tags.add(value))
    preferences.interests.forEach((value) => tags.add(value))
    if (extended.accessibilityNeeds.length) tags.add("accessible")
    if (Number(extended.travelCompanions || 1) > 2) tags.add("group")
    return Array.from(tags)
  }, [extended.accessibilityNeeds.length, extended.travelCompanions, preferences.interests, preferences.preferences])

  useEffect(() => {
    if (!recommendationFilters.includes(activeFilter)) setActiveFilter("all")
  }, [activeFilter, recommendationFilters])

  const recommendationEngine = useMemo(
    () =>
      EXPERIENCE_LIBRARY.map((experience) => ({ ...experience, ...scoreExperience(experience, preferences, extended) }))
        .sort((a, b) => b.score - a.score),
    [extended, preferences],
  )

  const filteredRecommendations = useMemo(() => {
    const ranked = recommendationEngine.filter((item) => item.score > 10)
    if (activeFilter === "all") return ranked.slice(0, 4)
    return ranked.filter((item) => item.matchedTags.includes(activeFilter)).slice(0, 4)
  }, [activeFilter, recommendationEngine])

  const travelTimeline = useMemo(
    () =>
      [...bookingTimeline].sort((a, b) =>
        String(b.date || b.createdAt || "").localeCompare(String(a.date || a.createdAt || "")),
      ),
    [bookingTimeline],
  )

  const topRecommendation = recommendationEngine[0]
  const companionSlots = Math.max(0, Number(extended.travelCompanions || 1) - 1)

  const toggleSelection = (key, value) => {
    setPreferences((current) => {
      const set = new Set(current[key])
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...current, [key]: Array.from(set) }
    })
  }

  const toggleAccessibility = (value) => {
    setExtended((current) => {
      const set = new Set(current.accessibilityNeeds)
      if (set.has(value)) set.delete(value)
      else set.add(value)
      return { ...current, accessibilityNeeds: Array.from(set) }
    })
  }

  const handleCompanionsChange = (nextValue) => {
    const nextCompanions = Math.max(1, Math.min(20, Number(nextValue) || 1))
    const nextSlots = Math.max(0, nextCompanions - 1)
    setExtended((current) => ({
      ...current,
      travelCompanions: nextCompanions,
      groupMembers: current.groupMembers.slice(0, nextSlots),
    }))
  }

  const addGroupMember = () => {
    const memberName = groupMemberDraft.trim()
    setError("")
    if (!memberName) return setError("Companion name is required.")
    if (extended.groupMembers.length >= companionSlots) return setError("All companion slots are already filled.")
    if (extended.groupMembers.some((entry) => entry.toLowerCase() === memberName.toLowerCase())) {
      return setError("Companion name already exists.")
    }
    setExtended((current) => ({ ...current, groupMembers: [...current.groupMembers, memberName] }))
    setGroupMemberDraft("")
    setMessage("Companion added to group profile.")
  }

  const removeGroupMember = (memberName) => {
    setExtended((current) => ({
      ...current,
      groupMembers: current.groupMembers.filter((item) => item !== memberName),
    }))
  }

  const handleRegister = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    const username = registerForm.username.trim()
    const email = registerForm.email.trim()

    if (username.length < 2) return setError("Name must have at least 2 characters.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.")

    try {
      const created = await api.users.create({ username, email })
      const companions = Math.max(1, Number(registerForm.companions) || 1)
      const nextExtended = {
        ...initialExtendedProfile(created.id),
        nationality: registerForm.nationality.trim(),
        travelCompanions: companions,
        groupMembers: [],
      }

      setUsers([...users, created])
      setSelectedUserId(String(created.id))
      setExtended(nextExtended)
      writeStoredJson(`tourism-profile-extra-${created.id}`, nextExtended)
      setRegisterForm({ username: "", email: "", nationality: "", companions: 1 })
      setMessage("Traveler profile created. Configure preferences and save.")
    } catch (requestError) {
      setError("Failed to register user.")
    }
  }

  const handleRestoreSnapshot = () => {
    if (!selectedUserId) return setError("Select a user profile first.")
    const snapshot = readStoredJson(`tourism-profile-snapshot-${selectedUserId}`, null)
    if (!snapshot) return setError("No saved snapshot found for this profile.")

    setPreferences((current) => ({
      ...current,
      ...snapshot.preferences,
      interests: snapshot.preferences?.interests || current.interests,
      preferences: snapshot.preferences?.preferences || current.preferences,
      budgetRange: snapshot.preferences?.budgetRange || current.budgetRange,
      nationality: snapshot.preferences?.nationality || current.nationality,
    }))
    setExtended((current) => ({
      ...current,
      ...snapshot.extended,
      accessibilityNeeds: snapshot.extended?.accessibilityNeeds || current.accessibilityNeeds,
      groupMembers: snapshot.extended?.groupMembers || current.groupMembers,
    }))
    setLastSavedAt(snapshot.savedAt || null)
    setMessage("Saved preferences restored.")
    setError("")
  }

  const handleSave = async () => {
    setError("")
    setMessage("")
    if (!selectedUserId) return setError("Select a user profile first.")
    if (!preferences.preferences.length || !preferences.interests.length) {
      return setError("Choose at least one preference and one interest tag before saving.")
    }

    setSaving(true)
    const nationality = preferences.nationality || extended.nationality || ""
    const payload = {
      user: { id: Number(selectedUserId) },
      interests: preferences.interests.join(","),
      preferences: preferences.preferences.join(","),
      budgetRange: preferences.budgetRange,
      accessibility: extended.accessibilityNeeds.join(","),
      nationality,
    }

    try {
      await api.preferences.save(payload)
      const nextExtended = {
        ...extended,
        nationality,
        groupMembers: extended.groupMembers.slice(0, companionSlots),
      }
      const savedAt = new Date().toISOString()
      writeStoredJson(`tourism-profile-extra-${selectedUserId}`, nextExtended)
      writeStoredJson(`tourism-profile-snapshot-${selectedUserId}`, {
        savedAt,
        preferences: { ...preferences, nationality },
        extended: nextExtended,
      })
      setExtended(nextExtended)
      setLastSavedAt(savedAt)
      setMessage("Profile and preferences saved for future trips.")
    } catch (requestError) {
      setError("Could not save preferences.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-6 pb-8">
        <header className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Profile Module</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">User Profile and Preference Studio</h1>
          <p className="mt-3 max-w-3xl text-sm text-cyan-50 md:text-base">
            Registration, preference tuning, group travel support, privacy controls, and profile-aware
            recommendations.
          </p>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <div className="stat-chip">
              <p className="text-lg font-bold">{users.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Profiles</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{profileCompleteness}%</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Completeness</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{topRecommendation?.score || 0}%</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Match Confidence</p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[340px_1fr]">
          <aside className="space-y-5">
            <section className="app-card">
              <h2 className="section-title text-lg">Register Traveler</h2>
              <p className="section-note">Create a profile for individual or group travel planning.</p>
              <form className="mt-3 space-y-2.5" onSubmit={handleRegister}>
                <input
                  className="input-control"
                  placeholder="Full name"
                  value={registerForm.username}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, username: event.target.value }))}
                />
                <input
                  className="input-control"
                  placeholder="Email address"
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                />
                <input
                  className="input-control"
                  placeholder="Nationality"
                  value={registerForm.nationality}
                  onChange={(event) =>
                    setRegisterForm((current) => ({ ...current, nationality: event.target.value }))
                  }
                />
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="input-control"
                  placeholder="Travel companions"
                  value={registerForm.companions}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, companions: event.target.value }))}
                />
                <button type="submit" className="btn-primary w-full">
                  Register profile
                </button>
              </form>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Multi-User Profiles</h2>
              <p className="section-note">Switch traveler context to keep separate preferences.</p>
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="input-control mt-3"
              >
                {!users.length && <option value="">No users found</option>}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Profile completeness
                  </p>
                  <p className="text-sm font-bold text-slate-700">{profileCompleteness}%</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded bg-slate-200">
                  <div
                    className="h-full rounded bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all"
                    style={{ width: `${profileCompleteness}%` }}
                  />
                </div>
                <div className="mt-3 space-y-1.5 text-xs">
                  {checklist.map((item) => (
                    <div key={item.label} className="flex items-center justify-between rounded-lg bg-white px-2 py-1.5">
                      <span className="text-slate-600">{item.label}</span>
                      <span className={item.done ? "font-semibold text-emerald-600" : "font-semibold text-amber-600"}>
                        {item.done ? "Done" : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Privacy and Future Trips</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span>Share profile for recommendations</span>
                  <input
                    type="checkbox"
                    checked={extended.privacyShareProfile}
                    onChange={(event) =>
                      setExtended((current) => ({ ...current, privacyShareProfile: event.target.checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span>Share location for context alerts</span>
                  <input
                    type="checkbox"
                    checked={extended.privacyShareLocation}
                    onChange={(event) =>
                      setExtended((current) => ({ ...current, privacyShareLocation: event.target.checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span>Appear in community matching</span>
                  <input
                    type="checkbox"
                    checked={extended.privacyShareCommunity}
                    onChange={(event) =>
                      setExtended((current) => ({ ...current, privacyShareCommunity: event.target.checked }))
                    }
                  />
                </label>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Language preference
                </label>
                <select
                  className="input-control"
                  value={extended.languagePreference}
                  onChange={(event) =>
                    setExtended((current) => ({ ...current, languagePreference: event.target.value }))
                  }
                >
                  {LANGUAGE_OPTIONS.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
              </div>

              <div className="app-card-soft mt-4 text-xs">
                <p className="font-semibold text-slate-700">Saved preference snapshot</p>
                <p className="mt-1 text-slate-500">Last saved: {formatDate(lastSavedAt)}</p>
                <button type="button" onClick={handleRestoreSnapshot} className="btn-secondary mt-3 w-full">
                  Restore saved snapshot
                </button>
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <section className="app-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="section-title text-lg">Preferences and Travel Inputs</h2>
                {selectedUser && (
                  <span className="chip">
                    Active: {selectedUser.username} ({selectedUser.email})
                  </span>
                )}
              </div>

              {loadingProfile && (
                <p className="mt-2 rounded-lg bg-cyan-50 px-3 py-2 text-xs font-semibold text-cyan-700">
                  Loading profile context...
                </p>
              )}

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Nationality
                  </label>
                  <input
                    value={preferences.nationality || extended.nationality}
                    onChange={(event) => {
                      const value = event.target.value
                      setPreferences((current) => ({ ...current, nationality: value }))
                      setExtended((current) => ({ ...current, nationality: value }))
                    }}
                    className="input-control"
                    placeholder="Nationality"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Travel companions
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={extended.travelCompanions}
                    onChange={(event) => handleCompanionsChange(event.target.value)}
                    className="input-control"
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Preference selector
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {PREFERENCE_OPTIONS.map((option) => {
                      const active = preferences.preferences.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleSelection("preferences", option)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            active ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {normalizeLabel(option)}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Interest tags
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((option) => {
                      const active = preferences.interests.includes(option)
                      return (
                        <button
                          key={option}
                          type="button"
                          onClick={() => toggleSelection("interests", option)}
                          className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                            active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {normalizeLabel(option)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Budget range slider
                  </p>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={budgetToSliderValue(preferences.budgetRange)}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        budgetRange: toBudgetLabel(Number(event.target.value)),
                      }))
                    }
                    className="w-full"
                  />
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Economy</span>
                    <span className="font-semibold text-slate-700">
                      Selected: {normalizeLabel(preferences.budgetRange)}
                    </span>
                    <span>Luxury</span>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Accessibility needs
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ACCESSIBILITY_OPTIONS.map((option) => {
                      const active = extended.accessibilityNeeds.includes(option)
                      return (
                        <button
                          type="button"
                          key={option}
                          onClick={() => toggleAccessibility(option)}
                          className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                            active ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                          }`}
                        >
                          {normalizeLabel(option)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="app-card-soft mt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-700">Group travel roster</p>
                  <p className="text-xs text-slate-500">
                    {extended.groupMembers.length}/{companionSlots} companions added
                  </p>
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    className="input-control"
                    placeholder="Companion name"
                    value={groupMemberDraft}
                    onChange={(event) => setGroupMemberDraft(event.target.value)}
                  />
                  <button type="button" onClick={addGroupMember} className="btn-secondary whitespace-nowrap">
                    Add
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {extended.groupMembers.map((member) => (
                    <button
                      type="button"
                      key={member}
                      onClick={() => removeGroupMember(member)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {member} x
                    </button>
                  ))}
                  {!extended.groupMembers.length && (
                    <span className="text-xs text-slate-500">Add companion names for group travel coordination.</span>
                  )}
                </div>
              </div>
            </section>

            <section className="app-card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-title text-lg">Personalized Recommendation Engine</h2>
                  <p className="section-note">Preference-based content filtering and itinerary suggestions.</p>
                </div>
                <span className="chip">Top match: {topRecommendation?.title || "Not available"}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recommendationFilters.map((filter) => (
                  <button
                    type="button"
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      activeFilter === filter
                        ? "bg-slate-800 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {normalizeLabel(filter)}
                  </button>
                ))}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {filteredRecommendations.map((item) => (
                  <article key={item.id} className="app-card-soft">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                      <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                        {item.score}% match
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {item.city} | {item.duration}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">{item.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.reasons.slice(0, 3).map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                    {item.missingAccessibility.length > 0 && (
                      <p className="mt-2 text-[11px] font-semibold text-amber-700">
                        Missing support: {item.missingAccessibility.map(normalizeLabel).join(", ")}
                      </p>
                    )}
                  </article>
                ))}
                {!filteredRecommendations.length && (
                  <p className="section-note md:col-span-2">
                    No high-confidence results for this filter. Adjust preference tags or budget range.
                  </p>
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Travel History Timeline</h2>
              <p className="section-note">Past trips and booking activity for this traveler profile.</p>
              <div className="mt-4 border-l border-slate-200 pl-4">
                {travelTimeline.map((booking) => (
                  <article key={booking.id} className="relative mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <span className="absolute -left-[1.38rem] top-5 h-2.5 w-2.5 rounded-full bg-cyan-600" />
                    <p className="text-sm font-semibold text-slate-800">
                      {booking.attraction?.name || booking.serviceName || "Travel booking"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      Date: {formatDate(booking.date || booking.createdAt)} | Location:{" "}
                      {booking.attraction?.city || booking.provider || "Unknown"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
                      Status: {normalizeLabel(booking.status || "confirmed")}
                    </p>
                  </article>
                ))}
                {!travelTimeline.length && <p className="section-note">No past trips yet for this profile.</p>}
              </div>
            </section>
          </section>
        </div>

        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary w-full py-3 text-base">
          {saving ? "Saving preferences..." : "Save profile and preferences"}
        </button>

        {(message || error) && (
          <div className={`app-card text-sm font-semibold ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}
      </div>
    </div>
  )
}
