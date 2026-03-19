import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const ALERT_TYPES = [
  { key: "weather", label: "Weather advisories", description: "Rain, heat, and activity advisories." },
  { key: "traffic", label: "Traffic and route conditions", description: "Road maintenance and route delays." },
  { key: "events", label: "Event changes and cancellations", description: "Schedule updates for local events." },
  { key: "safety", label: "Safety advisories", description: "Travel, location, and movement guidance." },
  { key: "emergency", label: "Emergency channel", description: "Critical notices and emergency contact prompts." },
]

const LEVEL_PRIORITY = {
  low: 1,
  medium: 2,
  high: 3,
}

const DEFAULT_SUBSCRIPTIONS = {
  weather: true,
  traffic: true,
  events: true,
  safety: true,
  emergency: true,
}

const DEFAULT_PREFERENCES = {
  minLevel: "low",
  autoRefreshSeconds: 25,
  geolocationEnabled: true,
  weatherSuggestionsEnabled: true,
}

const FALLBACK_FORECAST = [
  { day: "Today", summary: "24 C, light rain", advisory: "Indoor museums and food tours are recommended." },
  { day: "Tomorrow", summary: "26 C, partly cloudy", advisory: "Best window for city walks and viewpoints." },
  { day: "Day 3", summary: "22 C, moderate rain", advisory: "Prefer short transport connections and covered venues." },
]

function toLevelStyles(level) {
  if (level === "high") return "border-rose-300 bg-rose-50 text-rose-800"
  if (level === "medium") return "border-amber-300 bg-amber-50 text-amber-800"
  return "border-emerald-300 bg-emerald-50 text-emerald-800"
}

function normalizeAlertType(type) {
  if (!type) return "general"
  return String(type).toLowerCase()
}

function formatDate(value) {
  if (!value) return "Unknown time"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function getWeatherSuggestion(summary = "", advisory = "") {
  const text = `${summary} ${advisory}`.toLowerCase()
  if (text.includes("rain") || text.includes("storm")) {
    return "Prioritize indoor attractions, museums, and short transfer routes."
  }
  if (text.includes("partly") || text.includes("cloudy")) {
    return "Balanced day: combine outdoor viewpoints with city cultural stops."
  }
  if (text.includes("sun") || text.includes("clear")) {
    return "Strong conditions for parks, walking routes, and open-air activities."
  }
  return "Use current alerts to balance indoor and outdoor plans."
}

function getRouteGuidance(detail = "") {
  const text = detail.toLowerCase()
  if (text.includes("delay")) return "Use alternate route and allow extra travel buffer."
  if (text.includes("maintenance")) return "Expect temporary diversions around work zones."
  if (text.includes("no major disruptions")) return "Primary routes remain stable right now."
  return "Monitor route updates before departure."
}

function buildHistoryEntries(records) {
  const now = new Date().toISOString()
  return records.map((record) => ({
    id: record.id,
    type: normalizeAlertType(record.type),
    level: record.level || "low",
    title: record.title || "Alert update",
    detail: record.detail || "",
    ts: now,
  }))
}

export default function Notifications() {
  const [subscriptions, setSubscriptions] = useState(() =>
    readStoredJson("tourism-alert-subscriptions-v2", DEFAULT_SUBSCRIPTIONS),
  )
  const [preferences, setPreferences] = useState(() =>
    readStoredJson("tourism-alert-preferences-v2", DEFAULT_PREFERENCES),
  )
  const [alerts, setAlerts] = useState([])
  const [forecast, setForecast] = useState(FALLBACK_FORECAST)
  const [history, setHistory] = useState(() => readStoredJson("tourism-push-history-v2", []))
  const [dismissedAlerts, setDismissedAlerts] = useState(() => readStoredJson("tourism-dismissed-alerts-v2", []))
  const [geoLocation, setGeoLocation] = useState(() => readStoredJson("tourism-alert-geolocation-v2", null))
  const [locationStatus, setLocationStatus] = useState(() =>
    readStoredJson("tourism-alert-location-status-v2", "Location not shared"),
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const selectedTypes = useMemo(
    () => ALERT_TYPES.filter((type) => subscriptions[type.key]).map((type) => type.key),
    [subscriptions],
  )

  useEffect(() => {
    writeStoredJson("tourism-alert-subscriptions-v2", subscriptions)
  }, [subscriptions])

  useEffect(() => {
    writeStoredJson("tourism-alert-preferences-v2", preferences)
  }, [preferences])

  useEffect(() => {
    writeStoredJson("tourism-push-history-v2", history)
  }, [history])

  useEffect(() => {
    writeStoredJson("tourism-dismissed-alerts-v2", dismissedAlerts)
  }, [dismissedAlerts])

  useEffect(() => {
    writeStoredJson("tourism-alert-geolocation-v2", geoLocation)
    writeStoredJson("tourism-alert-location-status-v2", locationStatus)
  }, [geoLocation, locationStatus])

  useEffect(() => {
    if (!selectedTypes.length) {
      setAlerts([])
      setLoading(false)
      return
    }

    let cancelled = false

    const loadSnapshot = async (manual = false) => {
      if (!manual) setLoading(true)
      if (manual) setRefreshing(true)
      setError("")

      try {
        const [alertsResult, forecastResult] = await Promise.allSettled([
          api.notifications.alerts({
            types: selectedTypes,
            lat: preferences.geolocationEnabled ? geoLocation?.lat : null,
            lng: preferences.geolocationEnabled ? geoLocation?.lng : null,
          }),
          api.notifications.forecast(),
        ])

        if (cancelled) return

        const rawAlerts =
          alertsResult.status === "fulfilled" && Array.isArray(alertsResult.value) ? alertsResult.value : []

        const minPriority = LEVEL_PRIORITY[preferences.minLevel] || LEVEL_PRIORITY.low
        const filteredByLevel = rawAlerts.filter((alert) => {
          const alertLevel = LEVEL_PRIORITY[String(alert.level || "low").toLowerCase()] || LEVEL_PRIORITY.low
          return alertLevel >= minPriority
        })

        setAlerts(filteredByLevel)

        if (forecastResult.status === "fulfilled" && Array.isArray(forecastResult.value)) {
          setForecast(forecastResult.value.length ? forecastResult.value : FALLBACK_FORECAST)
        } else {
          setForecast(FALLBACK_FORECAST)
        }

        if (filteredByLevel.length) {
          const nextEntries = buildHistoryEntries(filteredByLevel.slice(0, 3))
          setHistory((current) => {
            const seen = new Set(current.map((entry) => `${entry.id}-${entry.title}-${entry.level}`))
            const merged = [...current]
            nextEntries.forEach((entry) => {
              const key = `${entry.id}-${entry.title}-${entry.level}`
              if (!seen.has(key)) merged.unshift(entry)
            })
            return merged.slice(0, 80)
          })
        }

        setLastRefresh(new Date())
        if (manual) setMessage("Alerts refreshed with latest disruption context.")
      } catch (requestError) {
        if (!cancelled) setError("Could not refresh notifications right now.")
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    loadSnapshot(false)

    const interval = setInterval(() => {
      loadSnapshot(false)
    }, Math.max(10, Number(preferences.autoRefreshSeconds) || 25) * 1000)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [
    geoLocation?.lat,
    geoLocation?.lng,
    preferences.autoRefreshSeconds,
    preferences.geolocationEnabled,
    preferences.minLevel,
    selectedTypes,
  ])

  const visibleAlerts = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          subscriptions[normalizeAlertType(alert.type)] &&
          !dismissedAlerts.includes(alert.id),
      ),
    [alerts, dismissedAlerts, subscriptions],
  )

  const unreadCount = useMemo(() => visibleAlerts.length, [visibleAlerts.length])
  const highPriorityCount = useMemo(
    () => visibleAlerts.filter((alert) => String(alert.level).toLowerCase() === "high").length,
    [visibleAlerts],
  )

  const trafficAlerts = useMemo(
    () => visibleAlerts.filter((alert) => normalizeAlertType(alert.type) === "traffic"),
    [visibleAlerts],
  )
  const eventAlerts = useMemo(
    () => visibleAlerts.filter((alert) => normalizeAlertType(alert.type) === "events"),
    [visibleAlerts],
  )
  const safetyAlerts = useMemo(
    () =>
      visibleAlerts.filter((alert) =>
        ["safety", "emergency"].includes(normalizeAlertType(alert.type)),
      ),
    [visibleAlerts],
  )

  const weatherSuggestions = useMemo(() => {
    if (!preferences.weatherSuggestionsEnabled) return []
    return forecast.slice(0, 3).map((item) => ({
      day: item.day,
      suggestion: getWeatherSuggestion(item.summary, item.advisory),
      summary: item.summary,
    }))
  }, [forecast, preferences.weatherSuggestionsEnabled])

  const emergencyAlert = useMemo(
    () => visibleAlerts.find((alert) => normalizeAlertType(alert.type) === "emergency"),
    [visibleAlerts],
  )

  const requestLocation = () => {
    setMessage("")
    setError("")

    if (!navigator.geolocation) {
      setLocationStatus("Geolocation is unavailable in this browser.")
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          lat: Number(position.coords.latitude.toFixed(3)),
          lng: Number(position.coords.longitude.toFixed(3)),
        }
        setGeoLocation(coords)
        setLocationStatus(`Location enabled: ${coords.lat}, ${coords.lng}`)
        setMessage("Geolocation enabled. Alerts are now localized.")
      },
      () => {
        setLocationStatus("Location permission denied.")
      },
    )
  }

  const dismissAlert = (alertId) => {
    setDismissedAlerts((current) => Array.from(new Set([...current, alertId])))
  }

  const clearDismissed = () => {
    setDismissedAlerts([])
  }

  const clearHistory = () => {
    setHistory([])
    setMessage("Push history log cleared.")
  }

  const refreshNow = async () => {
    setRefreshing(true)
    setError("")
    setMessage("")

    try {
      const [records, weather] = await Promise.all([
        api.notifications.alerts({
          types: selectedTypes,
          lat: preferences.geolocationEnabled ? geoLocation?.lat : null,
          lng: preferences.geolocationEnabled ? geoLocation?.lng : null,
        }),
        api.notifications.forecast(),
      ])

      const minPriority = LEVEL_PRIORITY[preferences.minLevel] || LEVEL_PRIORITY.low
      const filteredByLevel = (records || []).filter((alert) => {
        const alertLevel = LEVEL_PRIORITY[String(alert.level || "low").toLowerCase()] || LEVEL_PRIORITY.low
        return alertLevel >= minPriority
      })

      setAlerts(filteredByLevel)
      setForecast(weather?.length ? weather : FALLBACK_FORECAST)
      setLastRefresh(new Date())
      setMessage("Alerts refreshed with latest disruption context.")
    } catch (requestError) {
      setError("Manual refresh failed.")
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">Real-Time Updates and Notifications</h1>
          <p className="mt-2 text-slate-200">
            Notification center, weather advisories, route alerts, event changes, safety banners, and emergency updates.
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <div className="stat-chip">
              <p className="text-lg font-bold">{unreadCount}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Active Alerts</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{highPriorityCount}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">High Priority</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{history.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Push History</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{geoLocation ? "On" : "Off"}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Geo Alerts</p>
            </div>
          </div>
          <p className="mt-1 text-xs text-slate-300">Last refresh: {lastRefresh.toLocaleTimeString()}</p>
        </header>

        {emergencyAlert && (
          <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-800 shadow">
            <p className="text-sm font-semibold uppercase tracking-[0.08em]">Emergency Notification Channel</p>
            <p className="mt-1 text-base font-bold">{emergencyAlert.title}</p>
            <p className="text-sm">{emergencyAlert.detail}</p>
          </section>
        )}

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card xl:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Notification Center</h2>
                <p className="mt-1 text-sm text-slate-500">Live disruptions, updates, and travel messages by priority.</p>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={refreshNow} className="btn-primary" disabled={refreshing}>
                  {refreshing ? "Refreshing..." : "Refresh Now"}
                </button>
                <button type="button" onClick={clearDismissed} className="btn-secondary">
                  Restore Dismissed
                </button>
              </div>
            </div>

            {loading ? (
              <p className="mt-4 text-sm text-slate-600">Loading live alerts...</p>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleAlerts.map((alert) => (
                  <article key={alert.id} className={`rounded-xl border px-4 py-3 ${toLevelStyles(alert.level)}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">{alert.title}</h3>
                        <p className="mt-1 text-xs uppercase tracking-[0.08em]">{normalizeAlertType(alert.type)}</p>
                      </div>
                      <button type="button" onClick={() => dismissAlert(alert.id)} className="rounded border border-current px-2 py-1 text-[10px] font-semibold uppercase">
                        Dismiss
                      </button>
                    </div>
                    <p className="mt-2 text-sm">{alert.detail}</p>
                    <p className="mt-1 text-xs opacity-80">Updated: {formatDate(alert.timestamp)}</p>
                  </article>
                ))}
                {!visibleAlerts.length && (
                  <p className="rounded bg-slate-100 p-4 text-sm text-slate-600">
                    No alerts available for the current preferences.
                  </p>
                )}
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Alert Subscription Toggles</h2>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                {ALERT_TYPES.map((alertType) => (
                  <label key={alertType.key} className="block rounded-lg border border-slate-200 px-3 py-2">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-800">{alertType.label}</span>
                      <input
                        type="checkbox"
                        checked={subscriptions[alertType.key]}
                        onChange={(event) =>
                          setSubscriptions((current) => ({
                            ...current,
                            [alertType.key]: event.target.checked,
                          }))
                        }
                      />
                    </span>
                    <span className="mt-1 block text-xs text-slate-500">{alertType.description}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Custom Alert Preferences</h2>
              <div className="mt-3 space-y-3 text-sm">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Minimum Severity
                  </label>
                  <select
                    value={preferences.minLevel}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, minLevel: event.target.value }))
                    }
                    className="input-control"
                  >
                    <option value="low">Low and above</option>
                    <option value="medium">Medium and high</option>
                    <option value="high">High only</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Auto Refresh
                  </label>
                  <select
                    value={preferences.autoRefreshSeconds}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, autoRefreshSeconds: Number(event.target.value) }))
                    }
                    className="input-control"
                  >
                    {[15, 25, 40, 60].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        Every {seconds}s
                      </option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-slate-700">Geolocation-based relevant alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.geolocationEnabled}
                    onChange={(event) =>
                      setPreferences((current) => ({ ...current, geolocationEnabled: event.target.checked }))
                    }
                  />
                </label>
                <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2">
                  <span className="text-slate-700">Weather-integrated activity suggestions</span>
                  <input
                    type="checkbox"
                    checked={preferences.weatherSuggestionsEnabled}
                    onChange={(event) =>
                      setPreferences((current) => ({
                        ...current,
                        weatherSuggestionsEnabled: event.target.checked,
                      }))
                    }
                  />
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Weather Forecast Widget</h2>
            <div className="mt-3 space-y-3">
              {forecast.map((item) => (
                <div key={item.day} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {item.day}: {item.summary}
                  </p>
                  <p className="text-xs text-slate-600">{item.advisory}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Traffic and Route Conditions</h2>
            <div className="mt-3 space-y-2 text-sm">
              {trafficAlerts.map((alert) => (
                <div key={alert.id} className="rounded border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">{alert.title}</p>
                  <p className="text-xs text-amber-700">{alert.detail}</p>
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    Route guidance: {getRouteGuidance(alert.detail)}
                  </p>
                </div>
              ))}
              {!trafficAlerts.length && <p className="text-xs text-slate-500">No traffic disruptions at the moment.</p>}
            </div>
          </section>

          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Event Changes and Cancellations</h2>
            <div className="mt-3 space-y-2 text-sm">
              {eventAlerts.map((alert) => (
                <div key={alert.id} className="rounded border border-cyan-200 bg-cyan-50 p-3">
                  <p className="font-semibold text-cyan-800">{alert.title}</p>
                  <p className="text-xs text-cyan-700">{alert.detail}</p>
                </div>
              ))}
              {!eventAlerts.length && <p className="text-xs text-slate-500">No event changes currently reported.</p>}
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Safety and Travel Advisory Banners</h2>
            <div className="mt-3 space-y-2">
              {safetyAlerts.map((alert) => (
                <div key={alert.id} className={`rounded border px-3 py-2 text-sm ${toLevelStyles(alert.level)}`}>
                  <p className="font-semibold">{alert.title}</p>
                  <p className="text-xs">{alert.detail}</p>
                </div>
              ))}
              {!safetyAlerts.length && <p className="text-sm text-slate-500">No active safety advisories.</p>}
            </div>

            {weatherSuggestions.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Weather-Integrated Activity Suggestions
                </p>
                <div className="mt-2 space-y-2">
                  {weatherSuggestions.map((item) => (
                    <div key={item.day} className="rounded-lg bg-white p-2">
                      <p className="text-xs font-semibold text-slate-700">{item.day}</p>
                      <p className="text-xs text-slate-500">{item.summary}</p>
                      <p className="text-xs text-slate-600">{item.suggestion}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="space-y-6">
            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Geolocation Relevance</h2>
              <p className="mt-1 text-sm text-slate-600">Enable location for nearby route and disruption relevance.</p>
              <button type="button" className="btn-primary mt-3" onClick={requestLocation}>
                Enable live location tracking
              </button>
              <p className="mt-2 text-xs text-slate-500">{locationStatus}</p>
            </div>

            <div className="app-card">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-900">Push Notification History Log</h2>
                <button type="button" onClick={clearHistory} className="btn-secondary">
                  Clear
                </button>
              </div>
              <div className="mt-3 max-h-44 space-y-2 overflow-auto pr-1 text-xs text-slate-600">
                {history.map((entry, index) => (
                  <div key={`${entry.ts}-${entry.id}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-700">{entry.title}</p>
                    <p>
                      {entry.type} | {entry.level} | {formatDate(entry.ts)}
                    </p>
                  </div>
                ))}
                {!history.length && <p>No push notifications logged yet.</p>}
              </div>
            </div>
          </section>
        </div>

        {(message || error) && (
          <div className={`app-card text-sm font-semibold ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}
      </div>
    </div>
  )
}
