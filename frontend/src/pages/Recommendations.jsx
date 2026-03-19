import React, { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api"
import { estimateTravelMinutes, getDestinationMetadata, normalizeLabel } from "../data/tourismData"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const DEFAULT_PROFILE = {
  preferences: [],
  interests: [],
  budgetRange: "mid-range",
  accessibilityNeeds: [],
  travelCompanions: 1,
  nationality: "",
}

const PREFERENCE_KEYWORDS = {
  adventure: ["hike", "trail", "volcano", "safari", "park", "climb"],
  culture: ["museum", "heritage", "gallery", "history", "culture", "art"],
  relaxation: ["lake", "garden", "spa", "calm", "sunset", "resort"],
  family: ["family", "kids", "park", "safe", "museum", "picnic"],
  luxury: ["luxury", "premium", "exclusive", "private", "resort"],
}

const INTEREST_KEYWORDS = {
  hiking: ["hike", "trail", "mountain", "trek"],
  history: ["history", "heritage", "museum", "memorial"],
  wildlife: ["wildlife", "safari", "nature", "bird", "gorilla"],
  food: ["food", "restaurant", "market", "chef", "culinary"],
  photography: ["photo", "viewpoint", "sunrise", "landscape", "gallery"],
}

const FALLBACK_FORECAST = [
  { day: "Today", summary: "24 C, light rain", advisory: "Best for indoor culture and culinary experiences." },
  { day: "Tomorrow", summary: "26 C, partly cloudy", advisory: "Good conditions for mixed city and outdoor routes." },
]

const FALLBACK_EVENT_CALENDAR = [
  {
    id: "event-kigali-craft",
    title: "Kigali Craft and Food Market",
    detail: "Weekend artisan exhibitions and local tasting sessions.",
    city: "Kigali",
    dateLabel: "This Weekend",
    type: "market",
  },
  {
    id: "event-musanze-dance",
    title: "Musanze Cultural Dance Evening",
    detail: "Traditional dance program with local storytelling.",
    city: "Musanze",
    dateLabel: "Friday",
    type: "culture",
  },
  {
    id: "event-rubavu-cycle",
    title: "Lake Kivu Cycling Meetup",
    detail: "Community cycling loops with lakeside stops.",
    city: "Rubavu",
    dateLabel: "Sunday",
    type: "outdoor",
  },
]

function parseCsv(value) {
  return value ? String(value).split(",").map((entry) => entry.trim()).filter(Boolean) : []
}

function dedupeById(items) {
  const map = new Map()
  items.forEach((item) => {
    if (!item || item.id == null) return
    map.set(item.id, item)
  })
  return Array.from(map.values())
}

function keywordScore(text, keywords) {
  if (!keywords?.length) return 0
  return keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0)
}

function containsAnyKeyword(text, keywords) {
  return keywords.some((keyword) => text.includes(keyword))
}

function weatherModeFromForecast(summary) {
  const text = String(summary || "").toLowerCase()
  if (text.includes("rain") || text.includes("storm")) return "wet"
  if (text.includes("sun") || text.includes("clear")) return "clear"
  return "mixed"
}

function seasonalContext(monthIndex) {
  if (monthIndex >= 5 && monthIndex <= 8) {
    return {
      title: "Seasonal Banner: Peak Dry-Season Adventure",
      detail: "Clearer travel conditions support long-route outdoor recommendations and scenic circuits.",
      chip: "Outdoor Priority",
    }
  }
  if (monthIndex >= 9 && monthIndex <= 10) {
    return {
      title: "Seasonal Banner: Cultural Festival Window",
      detail: "Event-heavy recommendations are prioritized for markets, performances, and museum evenings.",
      chip: "Festival Mode",
    }
  }
  return {
    title: "Seasonal Banner: Green-Season Discovery",
    detail: "Indoor-ready and short-hop destination suggestions are boosted for weather resilience.",
    chip: "Balanced Route",
  }
}

function stableNudge(id, seed) {
  const numeric = Number(id) || String(id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)
  const value = (numeric + seed) % 5
  return value - 2
}

function readProfileSnapshot(userId) {
  if (!userId) return DEFAULT_PROFILE
  const snapshot = readStoredJson(`tourism-profile-snapshot-${userId}`, null)
  const extended = readStoredJson(`tourism-profile-extra-${userId}`, null)

  return {
    preferences: snapshot?.preferences?.preferences || [],
    interests: snapshot?.preferences?.interests || [],
    budgetRange: snapshot?.preferences?.budgetRange || "mid-range",
    accessibilityNeeds: snapshot?.extended?.accessibilityNeeds || extended?.accessibilityNeeds || [],
    travelCompanions: snapshot?.extended?.travelCompanions || extended?.travelCompanions || 1,
    nationality: snapshot?.preferences?.nationality || extended?.nationality || "",
  }
}

function getEventCalendarEntries(alerts, attractions) {
  const cities = Array.from(new Set(attractions.map((item) => item.city).filter(Boolean)))
  const fromAlerts = (alerts || []).map((alert, index) => {
    const text = `${alert.title || ""} ${alert.detail || ""}`.toLowerCase()
    const city = cities.find((candidate) => text.includes(candidate.toLowerCase())) || cities[0] || "Kigali"
    return {
      id: alert.id || `event-alert-${index}`,
      title: alert.title || "Local event update",
      detail: alert.detail || "Event context available for recommendation tuning.",
      city,
      dateLabel: "Today",
      type: "events",
    }
  })

  return fromAlerts.length ? fromAlerts : FALLBACK_EVENT_CALENDAR
}

function buildCollaborativeInsights(reviews, selectedUserId, feedback, attractionsById) {
  const currentUserId = Number(selectedUserId || 0)
  const positiveByUser = new Map()

  ;(reviews || []).forEach((review) => {
    if (Number(review.rating || 0) < 4) return
    const userId = Number(review.user?.id || 0)
    const attractionId = Number(review.attraction?.id || 0)
    if (!userId || !attractionId) return
    if (!positiveByUser.has(userId)) positiveByUser.set(userId, new Set())
    positiveByUser.get(userId).add(attractionId)
  })

  const likedSet = new Set((feedback?.liked || []).map(Number))
  const dislikedSet = new Set((feedback?.disliked || []).map(Number))
  const currentPositive = new Set(likedSet)

  if (currentUserId && positiveByUser.has(currentUserId)) {
    positiveByUser.get(currentUserId).forEach((attractionId) => currentPositive.add(attractionId))
  }

  const similarUsers = []
  positiveByUser.forEach((items, userId) => {
    if (userId === currentUserId) return
    let overlap = 0
    items.forEach((id) => {
      if (currentPositive.has(id)) overlap += 1
    })
    if (overlap > 0) similarUsers.push({ userId, overlap })
  })

  similarUsers.sort((a, b) => b.overlap - a.overlap)
  const scoreMap = new Map()

  similarUsers.slice(0, 6).forEach((similar) => {
    const items = positiveByUser.get(similar.userId) || new Set()
    items.forEach((attractionId) => {
      if (currentPositive.has(attractionId) || dislikedSet.has(attractionId)) return
      scoreMap.set(attractionId, (scoreMap.get(attractionId) || 0) + similar.overlap * 5)
    })
  })

  const topCollaborativeNames = Array.from(scoreMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([attractionId]) => attractionsById.get(Number(attractionId))?.name)
    .filter(Boolean)

  const line = topCollaborativeNames.length
    ? `Travelers like you also enjoyed ${topCollaborativeNames.join(", ")}.`
    : "Travelers like you also enjoyed lakeside walks and museum experiences."

  return {
    scoreMap,
    line,
    similarUsers: similarUsers.length,
  }
}

function buildMultiDayPlan(rankedAttractions, days) {
  const safeDays = Math.max(1, Math.min(7, Number(days) || 3))
  const pool = rankedAttractions.slice(0, Math.max(12, safeDays * 4))
  const used = new Set()

  const nextUnused = (preferKeywords = null) => {
    if (preferKeywords?.length) {
      const match = pool.find((item) => {
        if (used.has(item.id)) return false
        const text = `${item.name} ${item.description || ""}`.toLowerCase()
        return containsAnyKeyword(text, preferKeywords)
      })
      if (match) {
        used.add(match.id)
        return match
      }
    }

    const fallback = pool.find((item) => !used.has(item.id))
    if (fallback) used.add(fallback.id)
    return fallback || null
  }

  return Array.from({ length: safeDays }, (_, index) => {
    const morning = nextUnused(["museum", "park", "trail", "culture"])
    const afternoon = nextUnused(["market", "gallery", "heritage", "viewpoint"])
    const evening = nextUnused(["food", "market", "dinner", "city", "lake"])

    const transferMinutes =
      morning && afternoon
        ? estimateTravelMinutes(morning.metadata.coordinates, afternoon.metadata.coordinates, "drive")
        : 0

    return {
      dayLabel: `Day ${index + 1}`,
      morning,
      afternoon,
      evening,
      transferMinutes,
    }
  })
}

export default function Recommendations() {
  const [allAttractions, setAllAttractions] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUserId, setSelectedUserId] = useState(() => readStoredJson("tourism-reco-selected-user", ""))
  const [selectedCity, setSelectedCity] = useState("")
  const [cities, setCities] = useState([])
  const [profileModel, setProfileModel] = useState(DEFAULT_PROFILE)
  const [feedback, setFeedback] = useState({ liked: [], disliked: [], skipped: [] })
  const [discoverIndex, setDiscoverIndex] = useState(0)
  const [tripDays, setTripDays] = useState(() => readStoredJson("tourism-reco-trip-days", 3))
  const [eventAware, setEventAware] = useState(() => readStoredJson("tourism-reco-event-aware", true))
  const [weatherForecast, setWeatherForecast] = useState(FALLBACK_FORECAST)
  const [eventAlerts, setEventAlerts] = useState([])
  const [allReviews, setAllReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [refreshSeed, setRefreshSeed] = useState(() => Date.now())
  const [lastRefreshedAt, setLastRefreshedAt] = useState(() => new Date())

  const feedbackKey = `tourism-discover-feedback-${selectedUserId || "guest"}`

  useEffect(() => {
    writeStoredJson("tourism-reco-selected-user", selectedUserId)
  }, [selectedUserId])

  useEffect(() => {
    writeStoredJson("tourism-reco-trip-days", tripDays)
  }, [tripDays])

  useEffect(() => {
    writeStoredJson("tourism-reco-event-aware", eventAware)
  }, [eventAware])

  useEffect(() => {
    let cancelled = false

    Promise.allSettled([
      api.recommendations.list(),
      api.attractions.list(),
      api.users.list(),
      api.notifications.forecast(),
      api.notifications.alerts({ types: ["events"] }),
      api.reviews.list(),
    ]).then((results) => {
      if (cancelled) return

      const [recResult, attractionResult, usersResult, forecastResult, eventsResult, reviewsResult] = results
      const recs = recResult.status === "fulfilled" ? recResult.value.value || recResult.value || [] : []
      const attractions = attractionResult.status === "fulfilled" ? attractionResult.value.value || attractionResult.value || [] : []
      const merged = dedupeById([...recs, ...attractions])

      setAllAttractions(merged)
      setCities(Array.from(new Set(merged.map((item) => item.city).filter(Boolean))))

      const userList = usersResult.status === "fulfilled" ? usersResult.value.value || usersResult.value || [] : []
      setUsers(userList)
      if (!selectedUserId && userList.length) setSelectedUserId(String(userList[0].id))

      const forecast = forecastResult.status === "fulfilled" ? forecastResult.value || FALLBACK_FORECAST : FALLBACK_FORECAST
      setWeatherForecast(forecast)

      const events = eventsResult.status === "fulfilled" ? eventsResult.value || [] : []
      setEventAlerts(events)

      const reviews = reviewsResult.status === "fulfilled" ? reviewsResult.value.value || reviewsResult.value || [] : []
      setAllReviews(reviews)

      if (
        recResult.status !== "fulfilled" &&
        attractionResult.status !== "fulfilled" &&
        usersResult.status !== "fulfilled"
      ) {
        setError("Unable to load recommendation inputs.")
      }

      setLoading(false)
      setRefreshing(false)
      setLastRefreshedAt(new Date())
    })

    return () => {
      cancelled = true
    }
  }, [refreshSeed, selectedUserId])

  useEffect(() => {
    const stored = readStoredJson(feedbackKey, { liked: [], disliked: [], skipped: [] })
    setFeedback({
      liked: stored.liked || [],
      disliked: stored.disliked || [],
      skipped: stored.skipped || [],
    })
    setDiscoverIndex(0)
  }, [feedbackKey])

  useEffect(() => {
    writeStoredJson(feedbackKey, feedback)
  }, [feedback, feedbackKey])

  useEffect(() => {
    if (!selectedUserId) {
      setProfileModel(DEFAULT_PROFILE)
      return
    }

    let cancelled = false
    setLoadingProfile(true)

    const snapshotModel = readProfileSnapshot(selectedUserId)
    setProfileModel((current) => ({ ...current, ...snapshotModel }))

    api.preferences
      .get(Number(selectedUserId))
      .then((data) => {
        if (cancelled || !data) return
        setProfileModel((current) => ({
          ...current,
          preferences: parseCsv(data.preferences),
          interests: parseCsv(data.interests),
          budgetRange: data.budgetRange || current.budgetRange,
          accessibilityNeeds: parseCsv(data.accessibility),
          nationality: data.nationality || current.nationality,
        }))
      })
      .finally(() => {
        if (!cancelled) setLoadingProfile(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedUserId])

  const attractionById = useMemo(() => {
    const map = new Map()
    allAttractions.forEach((item) => map.set(Number(item.id), item))
    return map
  }, [allAttractions])

  const eventCalendar = useMemo(() => getEventCalendarEntries(eventAlerts, allAttractions), [eventAlerts, allAttractions])
  const weatherSummary = weatherForecast[0]?.summary || FALLBACK_FORECAST[0].summary
  const weatherMode = weatherModeFromForecast(weatherSummary)
  const nowHour = new Date().getHours()
  const seasonBanner = seasonalContext(new Date().getMonth())

  const eventCities = useMemo(
    () => new Set(eventCalendar.map((event) => event.city).filter(Boolean)),
    [eventCalendar],
  )

  const collaborative = useMemo(
    () => buildCollaborativeInsights(allReviews, selectedUserId, feedback, attractionById),
    [allReviews, selectedUserId, feedback, attractionById],
  )

  const filteredByCity = useMemo(() => {
    if (!selectedCity) return allAttractions
    return allAttractions.filter((item) => item.city === selectedCity)
  }, [allAttractions, selectedCity])

  const rankedAttractions = useMemo(() => {
    return filteredByCity
      .map((attraction) => {
        const metadata = getDestinationMetadata(attraction)
        const text = `${attraction.name || ""} ${attraction.description || ""} ${attraction.city || ""} ${metadata.category || ""}`.toLowerCase()
        let score = 45
        const reasons = []

        if (selectedCity && attraction.city === selectedCity) {
          score += 12
          reasons.push("City preference match")
        }

        profileModel.preferences.forEach((preference) => {
          const hits = keywordScore(text, PREFERENCE_KEYWORDS[preference] || [])
          if (hits > 0) {
            score += 8 + hits * 2
            reasons.push(`${normalizeLabel(preference)} preference fit`)
          }
        })

        profileModel.interests.forEach((interest) => {
          const hits = keywordScore(text, INTEREST_KEYWORDS[interest] || [])
          if (hits > 0) {
            score += 6 + hits
            reasons.push(`${normalizeLabel(interest)} interest signal`)
          }
        })

        if (feedback.liked.includes(attraction.id)) {
          score += 24
          reasons.push("You liked this destination")
        }
        if (feedback.disliked.includes(attraction.id)) {
          score -= 35
        }

        const collaborativeBoost = collaborative.scoreMap.get(Number(attraction.id)) || 0
        if (collaborativeBoost > 0) {
          score += Math.min(22, collaborativeBoost)
          reasons.push("Travelers like you enjoyed this")
        }

        if (weatherMode === "wet") {
          if (["museums", "markets", "restaurants", "culture"].includes(metadata.category)) {
            score += 10
            reasons.push("Weather-ready for rain")
          }
          if (["national-parks", "adventure"].includes(metadata.category)) {
            score -= 7
          }
        }

        if (weatherMode === "clear" && ["national-parks", "adventure"].includes(metadata.category)) {
          score += 9
          reasons.push("Great in clear weather")
        }

        if (eventAware && eventCities.has(attraction.city)) {
          score += 8
          reasons.push("Local event nearby")
        }

        if (nowHour >= 17) {
          if (containsAnyKeyword(text, ["market", "food", "night", "city", "music"])) {
            score += 6
            reasons.push("Fits evening planning")
          }
        } else if (nowHour <= 10 && containsAnyKeyword(text, ["museum", "park", "trail", "hike"])) {
          score += 4
          reasons.push("Strong morning option")
        }

        if (profileModel.budgetRange === "economy") {
          if (metadata.entryFeeUsd <= 10) score += 6
          if (metadata.entryFeeUsd >= 18) score -= 4
        } else if (profileModel.budgetRange === "mid-range") {
          if (metadata.entryFeeUsd >= 8 && metadata.entryFeeUsd <= 18) score += 5
        } else if (profileModel.budgetRange === "luxury") {
          if (metadata.entryFeeUsd >= 14) score += 7
        }

        if (!feedback.liked.includes(attraction.id) && !feedback.disliked.includes(attraction.id)) {
          score += 3
        }

        score += stableNudge(attraction.id, refreshSeed)

        return {
          ...attraction,
          metadata,
          score: Math.max(1, Math.min(99, Math.round(score))),
          reasons: Array.from(new Set(reasons)).slice(0, 4),
          eventMatch: eventAware && eventCities.has(attraction.city),
        }
      })
      .sort((a, b) => b.score - a.score)
  }, [
    collaborative.scoreMap,
    eventAware,
    eventCities,
    feedback.disliked,
    feedback.liked,
    filteredByCity,
    nowHour,
    profileModel.budgetRange,
    profileModel.interests,
    profileModel.preferences,
    refreshSeed,
    selectedCity,
    weatherMode,
  ])

  const personalizedFeed = useMemo(() => rankedAttractions.slice(0, 8), [rankedAttractions])
  const discoverPool = useMemo(
    () => rankedAttractions.filter((item) => !feedback.disliked.includes(item.id)),
    [rankedAttractions, feedback.disliked],
  )
  const discoverItem = useMemo(
    () => (discoverPool.length ? discoverPool[discoverIndex % discoverPool.length] : null),
    [discoverPool, discoverIndex],
  )
  const topPicksToday = useMemo(() => {
    return rankedAttractions.slice(0, 3).map((item) => {
      const cityEvent = eventCalendar.find((event) => event.city === item.city)
      return {
        ...item,
        weather: weatherForecast[0]?.summary || "Weather data unavailable",
        event: cityEvent?.title || "No major event tag",
      }
    })
  }, [rankedAttractions, eventCalendar, weatherForecast])
  const dailyPlans = useMemo(() => buildMultiDayPlan(rankedAttractions, tripDays), [rankedAttractions, tripDays])
  const recommendationQuality = useMemo(() => {
    if (!personalizedFeed.length) return 0
    return Math.round(personalizedFeed.reduce((sum, item) => sum + item.score, 0) / personalizedFeed.length)
  }, [personalizedFeed])

  const registerFeedback = (type) => {
    if (!discoverItem) return
    const attractionId = discoverItem.id
    setFeedback((current) => {
      const liked = new Set(current.liked)
      const disliked = new Set(current.disliked)
      const skipped = new Set(current.skipped)

      if (type === "liked") {
        liked.add(attractionId)
        disliked.delete(attractionId)
        skipped.delete(attractionId)
      } else if (type === "disliked") {
        disliked.add(attractionId)
        liked.delete(attractionId)
        skipped.delete(attractionId)
      } else if (!liked.has(attractionId) && !disliked.has(attractionId)) {
        skipped.add(attractionId)
      }

      return {
        liked: Array.from(liked),
        disliked: Array.from(disliked),
        skipped: Array.from(skipped),
      }
    })
    setDiscoverIndex((current) => current + 1)
  }

  const refreshRecommendations = () => {
    setRefreshing(true)
    setMessage("Refreshing recommendation model with latest context...")
    setRefreshSeed(Date.now())
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">Travel Recommendation Engine</h1>
          <p className="mt-2 text-slate-200">
            AI-style ranking, context-aware top picks, discover learning loop, and multi-day itinerary recommendations.
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <div className="stat-chip">
              <p className="text-lg font-bold">{personalizedFeed.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Feed Items</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{recommendationQuality}%</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Model Quality</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{feedback.liked.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Liked Signals</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{collaborative.similarUsers}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Similar Travelers</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-cyan-100">Last refreshed: {lastRefreshedAt.toLocaleTimeString()}</p>
        </header>

        <section className="rounded-2xl bg-gradient-to-r from-cyan-700 to-sky-800 p-6 text-white shadow-lg">
          <h2 className="text-lg font-bold">{seasonBanner.title}</h2>
          <p className="mt-1 text-sm">{seasonBanner.detail}</p>
          <span className="mt-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">{seasonBanner.chip}</span>
        </section>

        <section className="app-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Recommended for You</h2>
              <p className="text-xs text-slate-500">
                Personalized attraction feed using profile preferences, weather, events, and feedback learning.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={selectedUserId}
                onChange={(event) => setSelectedUserId(event.target.value)}
                className="input-control"
              >
                {!users.length && <option value="">No users</option>}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
              <select
                value={selectedCity}
                onChange={(event) => setSelectedCity(event.target.value)}
                className="input-control"
              >
                <option value="">All cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
              <button type="button" onClick={refreshRecommendations} className="btn-primary" disabled={refreshing}>
                {refreshing ? "Refreshing..." : "Manual Refresh"}
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <p>Weather context: {weatherSummary}</p>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={eventAware} onChange={(event) => setEventAware(event.target.checked)} />
              Event-aware scoring
            </label>
            {loadingProfile && <p className="font-semibold text-cyan-700">Loading profile signals...</p>}
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-slate-600">Loading recommendations...</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {personalizedFeed.map((item) => (
                <article key={item.id} className="app-card-soft">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                      {item.score}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    {item.city} | {normalizeLabel(item.metadata.category)}
                  </p>
                  <p className="mt-2 line-clamp-3 text-xs text-slate-600">{item.description}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {item.reasons.map((reason) => (
                      <span key={reason} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600">
                        {reason}
                      </span>
                    ))}
                  </div>
                  <Link to={`/attractions/${item.id}`} className="btn-secondary mt-3 w-full">
                    Open details
                  </Link>
                </article>
              ))}
              {!personalizedFeed.length && <p className="text-sm text-slate-500">No recommendations found.</p>}
            </div>
          )}
        </section>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Discover Swipe Interface</h2>
            <p className="mt-1 text-xs text-slate-500">Like or dislike destinations to train your recommendation profile.</p>
            {discoverItem ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">{discoverItem.name}</p>
                <p className="text-xs text-slate-500">
                  {discoverItem.city} | Match {discoverItem.score}%
                </p>
                <p className="mt-2 text-xs text-slate-600">{discoverItem.description}</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => registerFeedback("liked")}
                    className="rounded bg-emerald-600 px-2 py-2 text-xs font-semibold text-white"
                  >
                    Like
                  </button>
                  <button
                    type="button"
                    onClick={() => registerFeedback("disliked")}
                    className="rounded bg-rose-600 px-2 py-2 text-xs font-semibold text-white"
                  >
                    Dislike
                  </button>
                  <button
                    type="button"
                    onClick={() => registerFeedback("skipped")}
                    className="rounded bg-slate-700 px-2 py-2 text-xs font-semibold text-white"
                  >
                    Skip
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No discover cards available.</p>
            )}
            <div className="mt-3 text-xs text-slate-500">
              Learned signals: {feedback.liked.length} liked, {feedback.disliked.length} disliked, {feedback.skipped.length} skipped
            </div>
          </section>

          <section className="app-card xl:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Top Picks for Today</h2>
            <p className="mt-1 text-xs text-slate-500">Weather-based and event-based context-aware ranking.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {topPicksToday.map((item) => (
                <div key={item.id} className="app-card-soft">
                  <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.city}</p>
                  <p className="mt-2 text-xs text-slate-600">Weather: {item.weather}</p>
                  <p className="text-xs text-slate-600">Event: {item.event}</p>
                  <p className="mt-1 text-xs font-semibold text-cyan-700">Confidence: {item.score}%</p>
                </div>
              ))}
              {!topPicksToday.length && <p className="text-sm text-slate-500">Top picks unavailable.</p>}
            </div>
            <p className="mt-3 text-sm font-semibold text-indigo-700">{collaborative.line}</p>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="app-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-slate-900">Daily Itinerary Suggestions</h2>
              <select
                value={tripDays}
                onChange={(event) => setTripDays(Number(event.target.value))}
                className="input-control"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <option key={days} value={days}>
                    {days} day{days > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-1 text-xs text-slate-500">Multi-day trip planning logic uses ranked attractions and travel continuity.</p>
            <div className="mt-3 space-y-3">
              {dailyPlans.map((plan) => (
                <div key={plan.dayLabel} className="rounded border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-800">{plan.dayLabel}</p>
                  <p className="text-xs text-slate-600">Morning: {plan.morning?.name || "TBD"}</p>
                  <p className="text-xs text-slate-600">Afternoon: {plan.afternoon?.name || "TBD"}</p>
                  <p className="text-xs text-slate-600">Evening: {plan.evening?.name || "TBD"}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-700">
                    Midday transfer estimate: {plan.transferMinutes || 0} minutes
                  </p>
                </div>
              ))}
            </div>
            <Link to="/itineraries" className="btn-primary mt-4">
              Send plan to itinerary builder
            </Link>
          </section>

          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Local Event Calendar Integration</h2>
            <p className="mt-1 text-xs text-slate-500">Events are used as recommendation context signals by city.</p>
            <div className="mt-3 space-y-2">
              {eventCalendar.map((eventItem) => (
                <article key={eventItem.id} className="app-card-soft">
                  <p className="text-sm font-semibold text-slate-800">{eventItem.title}</p>
                  <p className="text-xs text-slate-500">
                    {eventItem.city} | {eventItem.dateLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{eventItem.detail}</p>
                </article>
              ))}
              {!eventCalendar.length && <p className="text-sm text-slate-500">No event data available.</p>}
            </div>
          </section>
        </div>

        {(message || error) && (
          <div
            className={`rounded-xl p-4 text-sm font-semibold ${
              error ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {error || message}
          </div>
        )}
      </div>
    </div>
  )
}
