import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { normalizeLabel, safeAverage } from "../data/tourismData"
import { readStoredJson } from "../utils/storage"

function safeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

function countBy(items, selector) {
  return items.reduce((accumulator, item) => {
    const key = selector(item) || "unknown"
    accumulator[key] = (accumulator[key] || 0) + 1
    return accumulator
  }, {})
}

function sumBy(items, selector) {
  return items.reduce((sum, item) => sum + Number(selector(item) || 0), 0)
}

function parseDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateOnly(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function toPercentage(value, total) {
  if (!total) return 0
  return Math.round((Number(value) / Number(total)) * 100)
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0))
}

function toDateInputValue(date) {
  return new Date(date).toISOString().slice(0, 10)
}

function normalizeCsvList(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
}

function toEndOfDay(date) {
  const copy = new Date(date)
  copy.setHours(23, 59, 59, 999)
  return copy
}

function toStartOfDay(date) {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

function diffDays(from, to) {
  const start = toStartOfDay(from)
  const end = toStartOfDay(to)
  const ms = end.getTime() - start.getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

function toCsv(rows) {
  if (!rows.length) return ""
  const headers = Object.keys(rows[0])
  const headerLine = headers.join(",")
  const bodyLines = rows.map((row) =>
    headers
      .map((key) => {
        const raw = row[key] == null ? "" : String(row[key])
        const escaped = raw.replace(/"/g, '""')
        return `"${escaped}"`
      })
      .join(","),
  )
  return [headerLine, ...bodyLines].join("\n")
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

function readStorageByPrefix(prefix) {
  if (typeof window === "undefined" || !window.localStorage) return []
  const entries = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(prefix)) continue
    try {
      const raw = window.localStorage.getItem(key)
      entries.push({ key, value: raw ? JSON.parse(raw) : null })
    } catch (error) {
      // Skip broken local entries.
    }
  }
  return entries
}

function inferAgeGroup(user, extendedProfile) {
  const ageCandidate = Number(
    extendedProfile?.age ??
      extendedProfile?.travelerAge ??
      user?.age ??
      user?.travelerAge ??
      NaN,
  )

  if (Number.isFinite(ageCandidate) && ageCandidate > 0) {
    if (ageCandidate < 18) return "<18"
    if (ageCandidate <= 24) return "18-24"
    if (ageCandidate <= 34) return "25-34"
    if (ageCandidate <= 44) return "35-44"
    if (ageCandidate <= 54) return "45-54"
    return "55+"
  }

  const birthValue =
    extendedProfile?.dateOfBirth || user?.dateOfBirth || extendedProfile?.birthDate || user?.birthDate
  if (birthValue) {
    const birth = parseDate(birthValue)
    if (birth) {
      const now = new Date()
      let age = now.getFullYear() - birth.getFullYear()
      const monthDiff = now.getMonth() - birth.getMonth()
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
      if (age > 0) return inferAgeGroup({ age }, null)
    }
  }

  return "unknown"
}

function normalizeBooking(booking, attractionById) {
  const attractionId = booking?.attraction?.id ?? booking?.attractionId ?? null
  const attraction = attractionId != null ? attractionById.get(Number(attractionId)) : null
  const serviceType = String(booking.serviceType || booking.type || (attractionId ? "tour" : "service")).toLowerCase()
  const serviceName = booking.serviceName || booking.name || booking?.attraction?.name || attraction?.name || "service"
  const city = booking?.attraction?.city || attraction?.city || booking.city || "unknown"
  const amountUsd = Number(booking.amountUsd ?? booking.amountPaid ?? 0)
  const selectedDate = dateOnly(booking.date || booking.selectedDate || booking.createdAt || new Date().toISOString())
  return {
    id: booking.id ?? null,
    ticketNumber: booking.ticketNumber || "",
    userId: booking.user?.id ?? booking.userId ?? null,
    attractionId: attractionId != null ? Number(attractionId) : null,
    serviceType,
    serviceName,
    city,
    status: String(booking.status || "CONFIRMED").toUpperCase(),
    amountUsd,
    confirmationChannel: String(booking.confirmationChannel || "in-app").toLowerCase(),
    selectedDate,
    createdAt: booking.createdAt || null,
  }
}

function mergeBookings(apiBookings, localBookings, attractionById) {
  const mergedMap = new Map()
  ;[...apiBookings, ...localBookings].forEach((entry) => {
    const normalized = normalizeBooking(entry, attractionById)
    const key =
      normalized.id != null
        ? `id-${normalized.id}`
        : normalized.ticketNumber
          ? `ticket-${normalized.ticketNumber}`
          : `hash-${normalized.serviceName}-${normalized.selectedDate}-${normalized.userId || "anon"}`
    mergedMap.set(key, normalized)
  })
  return Array.from(mergedMap.values())
}

function scoreLabel(score) {
  if (score >= 4.5) return "Excellent"
  if (score >= 4) return "Strong"
  if (score >= 3.5) return "Moderate"
  if (score > 0) return "Needs attention"
  return "No rating data"
}

export default function Analytics() {
  const [users, setUsers] = useState([])
  const [bookings, setBookings] = useState([])
  const [reviews, setReviews] = useState([])
  const [preferences, setPreferences] = useState([])
  const [attractions, setAttractions] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(() => toDateInputValue(Date.now() - 1000 * 60 * 60 * 24 * 30))
  const [dateTo, setDateTo] = useState(() => toDateInputValue(Date.now()))
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([
      api.users.list(),
      api.bookings.list(),
      api.reviews.list(),
      api.attractions.list(),
      api.preferences.list(),
    ])
      .then(([userResult, bookingResult, reviewResult, attractionResult, preferenceResult]) => {
        if (cancelled) return
        setUsers(userResult.status === "fulfilled" ? safeList(userResult.value) : [])
        setBookings(bookingResult.status === "fulfilled" ? safeList(bookingResult.value) : [])
        setReviews(reviewResult.status === "fulfilled" ? safeList(reviewResult.value) : [])
        setAttractions(attractionResult.status === "fulfilled" ? safeList(attractionResult.value) : [])
        setPreferences(preferenceResult.status === "fulfilled" ? safeList(preferenceResult.value) : [])
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setError("Could not load analytics inputs.")
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])
  const metrics = useMemo(() => {
    const from = parseDate(dateFrom)
    const to = parseDate(dateTo)
    const toRange = to ? toEndOfDay(to) : null
    const inRange = (value) => {
      const parsed = parseDate(value)
      if (!parsed) return false
      if (from && parsed < from) return false
      if (toRange && parsed > toRange) return false
      return true
    }

    const attractionById = new Map(attractions.map((attraction) => [Number(attraction.id), attraction]))
    const localBookings = [
      ...readStoredJson("tourism-booking-records-v3", []),
      ...readStoredJson("tourism-booking-records-v2", []),
    ]
    const mergedBookings = mergeBookings(bookings, localBookings, attractionById)

    const activeBookings = mergedBookings.filter((booking) => booking.status !== "CANCELLED")
    const filteredBookings = activeBookings.filter((booking) => inRange(booking.selectedDate || booking.createdAt))
    const filteredAllStatuses = mergedBookings.filter((booking) => inRange(booking.selectedDate || booking.createdAt))
    const filteredReviews = reviews.filter((review) =>
      inRange(review.createdAt || review.date || new Date().toISOString()),
    )

    const savedPlaces = readStoredJson(
      "tourism-destination-saved-places",
      readStoredJson("tourism-saved-places", []),
    )
    const bookingCart = readStoredJson(
      "tourism-booking-cart-v3",
      readStoredJson("tourism-booking-cart", []),
    )
    const pushHistory = readStoredJson(
      "tourism-push-history-v2",
      readStoredJson("tourism-push-history", []),
    )
    const bookingNotificationLog = readStoredJson("tourism-booking-notification-log-v1", [])
    const attractionViewMap = readStoredJson("tourism-attraction-views", {})

    const recommendationFeedback = readStorageByPrefix("tourism-discover-feedback-")
      .flatMap((entry) => [entry.value])
      .filter(Boolean)

    const profileExtrasByUser = new Map(
      users.map((user) => [String(user.id), readStoredJson(`tourism-profile-extra-${user.id}`, null)]),
    )

    const preferenceByUserId = new Map(
      preferences
        .filter((item) => item?.user?.id != null)
        .map((item) => [String(item.user.id), item]),
    )

    const nationalityBreakdown = countBy(users, (user) => {
      const preference = preferenceByUserId.get(String(user.id))
      return preference?.nationality || user.nationality || "unknown"
    })

    const ageBreakdown = countBy(users, (user) => inferAgeGroup(user, profileExtrasByUser.get(String(user.id))))

    const interestBreakdown = countBy(
      preferences.flatMap((entry) => normalizeCsvList(entry.interests)),
      (interest) => interest,
    )

    const viewCount = Object.values(attractionViewMap).reduce((sum, value) => sum + Number(value || 0), 0)
    const savedCount = savedPlaces.length
    const cartCount = bookingCart.length
    const bookedCount = filteredBookings.length
    const revenue = sumBy(filteredBookings, (booking) => booking.amountUsd)
    const conversionRate = toPercentage(bookedCount, Math.max(1, viewCount))

    const bookingFunnel = {
      viewed: viewCount,
      saved: savedCount,
      cart: cartCount,
      booked: bookedCount,
    }

    const stageDropOff = {
      viewToSave: toPercentage(bookingFunnel.saved, Math.max(1, bookingFunnel.viewed)),
      saveToCart: toPercentage(bookingFunnel.cart, Math.max(1, bookingFunnel.saved)),
      cartToBook: toPercentage(bookingFunnel.booked, Math.max(1, bookingFunnel.cart)),
    }

    const cityHeatmap = countBy(filteredBookings, (booking) => booking.city || "unknown")
    const activityHeatmap = countBy(filteredBookings, (booking) => booking.serviceType || "service")

    const attractionRatings = reviews.reduce((accumulator, review) => {
      const attractionId = Number(review?.attraction?.id || review?.attractionId || 0)
      if (!attractionId) return accumulator
      if (!accumulator[attractionId]) accumulator[attractionId] = []
      accumulator[attractionId].push(Number(review.rating || 0))
      return accumulator
    }, {})

    const satisfaction = safeAverage(filteredReviews.map((review) => Number(review.rating || 0)))
    const satisfactionDistribution = [5, 4, 3, 2, 1].map((rating) => ({
      rating,
      count: filteredReviews.filter((review) => Number(review.rating || 0) === rating).length,
    }))

    const mostViewedDestinations = Object.entries(attractionViewMap)
      .map(([attractionId, count]) => ({
        attractionId: Number(attractionId),
        name: attractionById.get(Number(attractionId))?.name || `Destination ${attractionId}`,
        count: Number(count || 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const mostSavedDestinations = Object.entries(
      countBy(savedPlaces, (place) => place?.name || "unknown"),
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const mostBookedDestinations = Object.entries(
      countBy(filteredBookings, (booking) => booking.serviceName || "unknown"),
    )
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    const servicePerformance = Object.entries(
      filteredAllStatuses.reduce((accumulator, booking) => {
        const key = booking.serviceType || "service"
        if (!accumulator[key]) {
          accumulator[key] = {
            serviceType: key,
            bookings: 0,
            cancellations: 0,
            revenueUsd: 0,
            leadDays: [],
            reviewScores: [],
          }
        }
        const bucket = accumulator[key]
        bucket.bookings += 1
        if (booking.status === "CANCELLED") bucket.cancellations += 1
        if (booking.status !== "CANCELLED") bucket.revenueUsd += Number(booking.amountUsd || 0)

        const createdAt = parseDate(booking.createdAt || booking.selectedDate)
        const selectedAt = parseDate(booking.selectedDate)
        if (createdAt && selectedAt) {
          bucket.leadDays.push(Math.max(0, diffDays(createdAt, selectedAt)))
        }

        if (booking.attractionId && attractionRatings[booking.attractionId]?.length) {
          bucket.reviewScores.push(safeAverage(attractionRatings[booking.attractionId]))
        }
        return accumulator
      }, {}),
    )
      .map(([, bucket]) => ({
        serviceType: bucket.serviceType,
        bookings: bucket.bookings,
        revenueUsd: Math.round(bucket.revenueUsd),
        cancellationRate: toPercentage(bucket.cancellations, Math.max(1, bucket.bookings)),
        averageLeadDays: Number(safeAverage(bucket.leadDays).toFixed(1)),
        serviceScore: Number(safeAverage(bucket.reviewScores).toFixed(2)),
      }))
      .sort((a, b) => b.bookings - a.bookings)

    const now = new Date()
    const recentStart = toStartOfDay(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 14))
    const previousStart = toStartOfDay(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 28))

    const allDemandCounts = filteredBookings.reduce((accumulator, booking) => {
      const key = booking.serviceName || "unknown"
      if (!accumulator[key]) accumulator[key] = { current: 0, recent: 0, previous: 0 }
      accumulator[key].current += 1

      const bookingDate = parseDate(booking.selectedDate || booking.createdAt)
      if (bookingDate && bookingDate >= recentStart) {
        accumulator[key].recent += 1
      } else if (bookingDate && bookingDate >= previousStart && bookingDate < recentStart) {
        accumulator[key].previous += 1
      }
      return accumulator
    }, {})

    const demandForecast = Object.entries(allDemandCounts)
      .map(([name, values]) => {
        const growthRate = values.previous
          ? (values.recent - values.previous) / values.previous
          : values.recent
            ? 1
            : 0
        const projected = Math.max(values.current, Math.round(values.current * (1 + growthRate * 0.6)))
        return {
          name,
          current: values.current,
          trend: Number(growthRate.toFixed(2)),
          forecastNextCycle: projected,
        }
      })
      .sort((a, b) => b.forecastNextCycle - a.forecastNextCycle)
      .slice(0, 8)

    const channelConversions = countBy(filteredBookings, (booking) => booking.confirmationChannel || "in-app")
    const reminderNotifications = bookingNotificationLog.filter((entry) =>
      String(entry.title || "").toLowerCase().includes("reminder"),
    )
    const pushExposures = pushHistory.length
    const discoverEngagement = recommendationFeedback.reduce(
      (sum, item) => sum + Number(item?.liked?.length || 0) + Number(item?.disliked?.length || 0),
      0,
    )

    const likedAttractionIds = new Set(
      recommendationFeedback.flatMap((item) => (Array.isArray(item?.liked) ? item.liked : [])),
    )
    const discoverConversions = filteredBookings.filter((booking) =>
      likedAttractionIds.has(Number(booking.attractionId || -1)),
    ).length

    const campaignEffectiveness = [
      {
        campaign: "Email Reminder Campaign",
        exposures: reminderNotifications.filter((entry) =>
          String(entry.title || "").toLowerCase().includes("email"),
        ).length,
        conversions: Number(channelConversions.email || 0),
      },
      {
        campaign: "SMS Reminder Campaign",
        exposures: reminderNotifications.filter((entry) =>
          String(entry.title || "").toLowerCase().includes("sms"),
        ).length,
        conversions: Number(channelConversions.sms || 0),
      },
      {
        campaign: "Push Notification Campaign",
        exposures: pushExposures,
        conversions: Number(channelConversions["in-app"] || 0),
      },
      {
        campaign: "Discover Feed Campaign",
        exposures: discoverEngagement,
        conversions: discoverConversions,
      },
    ].map((entry) => ({
      ...entry,
      conversionRate: toPercentage(entry.conversions, Math.max(1, entry.exposures)),
    }))

    const topInterests = Object.entries(interestBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([interest]) => interest)
    const topCities = Object.entries(cityHeatmap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([city]) => city)
    const topNationalities = Object.entries(nationalityBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([nationality]) => nationality)

    const packageIdeas = demandForecast.slice(0, 3).map((entry, index) => {
      const focusInterest = topInterests[index % Math.max(1, topInterests.length)] || "culture"
      const focusCity = topCities[index % Math.max(1, topCities.length)] || "Kigali"
      const audience = topNationalities[index % Math.max(1, topNationalities.length)] || "mixed audiences"
      const expectedLift = clamp(12 + entry.forecastNextCycle * 2, 10, 48)
      return {
        id: `${entry.name}-${index}`,
        title: `${normalizeLabel(focusInterest)} Experience Pack`,
        baseDestination: entry.name,
        city: focusCity,
        audience,
        expectedLift,
        rationale: `${entry.name} demand is trending ${entry.trend >= 0 ? "upward" : "downward"} (${entry.trend}).`,
      }
    })

    return {
      from: dateFrom,
      to: dateTo,
      filteredBookings,
      filteredReviews,
      viewCount,
      savedCount,
      cartCount,
      bookedCount,
      revenue,
      conversionRate,
      bookingFunnel,
      stageDropOff,
      nationalityBreakdown,
      ageBreakdown,
      interestBreakdown,
      cityHeatmap,
      activityHeatmap,
      satisfaction,
      satisfactionDistribution,
      mostViewedDestinations,
      mostSavedDestinations,
      mostBookedDestinations,
      demandForecast,
      servicePerformance,
      campaignEffectiveness,
      packageIdeas,
      pushExposures,
      discoverEngagement,
    }
  }, [attractions, bookings, dateFrom, dateTo, preferences, reviews, users])

  const exportReport = (format) => {
    setError("")
    setMessage("")
    if (format === "json") {
      const payload = {
        generatedAt: new Date().toISOString(),
        range: { from: metrics.from, to: metrics.to },
        engagement: {
          viewed: metrics.viewCount,
          saved: metrics.savedCount,
          cart: metrics.cartCount,
          booked: metrics.bookedCount,
          revenue: metrics.revenue,
          conversionRate: metrics.conversionRate,
        },
        demographics: {
          nationality: metrics.nationalityBreakdown,
          age: metrics.ageBreakdown,
          interests: metrics.interestBreakdown,
        },
        funnel: metrics.bookingFunnel,
        funnelStageRates: metrics.stageDropOff,
        heatmaps: {
          city: metrics.cityHeatmap,
          activity: metrics.activityHeatmap,
        },
        quality: {
          satisfactionScore: Number(metrics.satisfaction.toFixed(2)),
          servicePerformance: metrics.servicePerformance,
        },
        forecasting: metrics.demandForecast,
        campaigns: metrics.campaignEffectiveness,
        packageIdeas: metrics.packageIdeas,
      }
      downloadFile(
        `tourism-analytics-${metrics.from}-to-${metrics.to}.json`,
        JSON.stringify(payload, null, 2),
        "application/json",
      )
      setMessage("Analytics JSON report exported.")
      return
    }

    const csvRows = [
      { section: "Engagement", metric: "Viewed", value: metrics.viewCount },
      { section: "Engagement", metric: "Saved", value: metrics.savedCount },
      { section: "Engagement", metric: "Cart", value: metrics.cartCount },
      { section: "Engagement", metric: "Booked", value: metrics.bookedCount },
      { section: "Engagement", metric: "Revenue USD", value: metrics.revenue },
      { section: "Engagement", metric: "Conversion %", value: metrics.conversionRate },
      { section: "Satisfaction", metric: "Average Rating", value: metrics.satisfaction.toFixed(2) },
      ...metrics.demandForecast.map((entry) => ({
        section: "Forecast",
        metric: `${entry.name} next cycle`,
        value: entry.forecastNextCycle,
      })),
      ...metrics.servicePerformance.map((entry) => ({
        section: "Service Performance",
        metric: normalizeLabel(entry.serviceType),
        value: `Bookings ${entry.bookings}, Revenue ${entry.revenueUsd}, Cancel ${entry.cancellationRate}%`,
      })),
      ...metrics.campaignEffectiveness.map((entry) => ({
        section: "Campaign",
        metric: entry.campaign,
        value: `Exposure ${entry.exposures}, Conversion ${entry.conversions} (${entry.conversionRate}%)`,
      })),
    ]

    downloadFile(
      `tourism-analytics-${metrics.from}-to-${metrics.to}.csv`,
      toCsv(csvRows),
      "text/csv;charset=utf-8",
    )
    setMessage("Analytics CSV report exported.")
  }

  if (loading) {
    return (
      <div className="page-stage">
        <div className="shell-container">
          <div className="app-card text-sm text-slate-600">Loading analytics workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8 pb-8">
        <header className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Analytics Module</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Admin and Tour Operator Insights Hub</h1>
          <p className="mt-3 max-w-4xl text-sm text-cyan-50 md:text-base">
            Engagement behavior, demographic charts, destination and activity heatmaps, conversion funnel analytics, demand forecasts, campaign effectiveness, and package strategy support.
          </p>
        </header>

        <section className="app-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="section-title text-lg">Custom Date Range and Export Panel</h2>
              <p className="section-note">Filter analytics windows and export admin reports as JSON or CSV.</p>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="input-control"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="input-control"
              />
              <button type="button" className="btn-secondary" onClick={() => exportReport("json")}>
                Export JSON
              </button>
              <button type="button" className="btn-primary" onClick={() => exportReport("csv")}>
                Export CSV
              </button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Viewed" value={metrics.viewCount} detail="Destination detail opens" />
          <MetricCard label="Saved" value={metrics.savedCount} detail="Saved destinations" />
          <MetricCard label="Booked" value={metrics.bookedCount} detail="Confirmed bookings" />
          <MetricCard label="Revenue" value={`$${metrics.revenue}`} detail="Estimated service revenue" />
          <MetricCard label="Conversion" value={`${metrics.conversionRate}%`} detail="Viewed to booked" />
          <MetricCard
            label="Satisfaction"
            value={metrics.satisfaction ? metrics.satisfaction.toFixed(1) : "0.0"}
            detail={scoreLabel(metrics.satisfaction)}
          />
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <section className="app-card">
            <h2 className="section-title text-lg">Most Viewed Destinations</h2>
            <ListPanel rows={metrics.mostViewedDestinations.map((item) => ({ label: item.name, value: item.count }))} emptyText="No view data available." />
          </section>
          <section className="app-card">
            <h2 className="section-title text-lg">Most Saved Destinations</h2>
            <ListPanel rows={metrics.mostSavedDestinations.map((item) => ({ label: item.name, value: item.count }))} emptyText="No save behavior data available." />
          </section>
          <section className="app-card">
            <h2 className="section-title text-lg">Most Booked Services</h2>
            <ListPanel rows={metrics.mostBookedDestinations.map((item) => ({ label: item.name, value: item.count }))} emptyText="No booking data in selected range." />
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <section className="app-card">
            <h2 className="section-title text-lg">Demographic Insights: Nationality</h2>
            <BarTable entries={Object.entries(metrics.nationalityBreakdown)} />
          </section>
          <section className="app-card">
            <h2 className="section-title text-lg">Demographic Insights: Age</h2>
            <BarTable entries={Object.entries(metrics.ageBreakdown)} />
          </section>
          <section className="app-card">
            <h2 className="section-title text-lg">Interest Preferences</h2>
            <BarTable entries={Object.entries(metrics.interestBreakdown)} />
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
          <section className="app-card">
            <h2 className="section-title text-lg">Booking Conversion Funnel</h2>
            <p className="section-note">Tourist behavior progression from viewing to confirmed bookings.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              {Object.entries(metrics.bookingFunnel).map(([stage, value]) => (
                <div key={stage} className="app-card-soft text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{stage}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <RateCard label="View to Save" value={metrics.stageDropOff.viewToSave} />
              <RateCard label="Save to Cart" value={metrics.stageDropOff.saveToCart} />
              <RateCard label="Cart to Booking" value={metrics.stageDropOff.cartToBook} />
            </div>
          </section>

          <section className="app-card">
            <h2 className="section-title text-lg">Customer Satisfaction Tracker</h2>
            <p className="section-note">{metrics.filteredReviews.length} reviews in selected range</p>
            <div className="mt-4 h-3 rounded-full bg-slate-200">
              <div
                className="h-3 rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, Math.round((metrics.satisfaction / 5) * 100))}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Average score: {metrics.satisfaction.toFixed(2)} / 5.00 ({scoreLabel(metrics.satisfaction)})
            </p>
            <div className="mt-4 space-y-2">
              {metrics.satisfactionDistribution.map((item) => (
                <div key={item.rating}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
                    <span>{item.rating} star</span>
                    <span>{item.count}</span>
                  </div>
                  <div className="h-2 rounded bg-slate-200">
                    <div
                      className="h-2 rounded bg-cyan-600"
                      style={{
                        width: `${metrics.filteredReviews.length ? Math.round((item.count / metrics.filteredReviews.length) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <section className="app-card">
            <h2 className="section-title text-lg">Popular Destination Heatmap</h2>
            <p className="section-note">Booking concentration by city.</p>
            <HeatmapGrid entries={Object.entries(metrics.cityHeatmap)} />
          </section>
          <section className="app-card">
            <h2 className="section-title text-lg">Activity Heatmap</h2>
            <p className="section-note">Service demand by activity type.</p>
            <HeatmapGrid entries={Object.entries(metrics.activityHeatmap)} normalizeLabels />
          </section>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <section className="app-card">
            <h2 className="section-title text-lg">Demand Forecasting for Attractions and Services</h2>
            <p className="section-note">Trend-informed projection for next booking cycle.</p>
            <div className="mt-4 space-y-2">
              {metrics.demandForecast.map((item) => (
                <article key={item.name} className="app-card-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                      <p className="text-xs text-slate-500">Current demand: {item.current}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.trend >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      Trend {item.trend >= 0 ? "+" : ""}
                      {item.trend}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-cyan-700">Forecast next cycle: {item.forecastNextCycle}</p>
                </article>
              ))}
              {!metrics.demandForecast.length && <p className="section-note">No forecast data available.</p>}
            </div>
          </section>

          <section className="app-card">
            <h2 className="section-title text-lg">Data-Driven Package Development</h2>
            <p className="section-note">Suggested package directions using live demand and preference data.</p>
            <div className="mt-4 space-y-2">
              {metrics.packageIdeas.map((item) => (
                <article key={item.id} className="app-card-soft">
                  <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                  <p className="text-xs text-slate-500">
                    Base: {item.baseDestination} | City: {item.city}
                  </p>
                  <p className="text-xs text-slate-500">Audience: {item.audience}</p>
                  <p className="mt-1 text-xs text-slate-600">{item.rationale}</p>
                  <p className="mt-1 text-xs font-semibold text-cyan-700">Estimated uplift: {item.expectedLift}%</p>
                </article>
              ))}
              {!metrics.packageIdeas.length && <p className="section-note">Package strategy suggestions will appear with enough data.</p>}
            </div>
          </section>
        </section>

        <section className="app-card">
          <h2 className="section-title text-lg">Service Performance Metrics</h2>
          <p className="section-note">Operational KPIs by service type for operator decisions.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.servicePerformance.map((entry) => (
              <article key={entry.serviceType} className="app-card-soft">
                <p className="text-sm font-semibold text-slate-700">{normalizeLabel(entry.serviceType)}</p>
                <p className="text-xs text-slate-500">Bookings: {entry.bookings}</p>
                <p className="text-xs text-slate-500">Revenue: ${entry.revenueUsd}</p>
                <p className="text-xs text-slate-500">Cancellation: {entry.cancellationRate}%</p>
                <p className="text-xs text-slate-500">Avg lead time: {entry.averageLeadDays} days</p>
                <p className="mt-1 text-xs font-semibold text-cyan-700">
                  Service score: {entry.serviceScore ? entry.serviceScore.toFixed(2) : "N/A"}
                </p>
              </article>
            ))}
            {!metrics.servicePerformance.length && <p className="section-note md:col-span-2 xl:col-span-4">No service performance data in this range.</p>}
          </div>
        </section>

        <section className="app-card">
          <h2 className="section-title text-lg">Marketing Campaign Effectiveness</h2>
          <p className="section-note">Channel exposure vs conversion signals from reminders, push alerts, and discovery feed activity.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {metrics.campaignEffectiveness.map((campaign) => (
              <article key={campaign.campaign} className="app-card-soft">
                <p className="text-sm font-semibold text-slate-700">{campaign.campaign}</p>
                <p className="text-xs text-slate-500">Exposures: {campaign.exposures}</p>
                <p className="text-xs text-slate-500">Conversions: {campaign.conversions}</p>
                <p className="mt-1 text-xs font-semibold text-cyan-700">Conversion rate: {campaign.conversionRate}%</p>
              </article>
            ))}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="app-card-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Push Touchpoints</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{metrics.pushExposures}</p>
            </div>
            <div className="app-card-soft">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Discover Engagement Actions</p>
              <p className="mt-1 text-lg font-bold text-slate-800">{metrics.discoverEngagement}</p>
            </div>
          </div>
        </section>

        {(message || error) && (
          <div className={`app-card text-sm font-semibold ${error ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {error || message}
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="app-card">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </article>
  )
}

function ListPanel({ rows, emptyText }) {
  return (
    <div className="mt-3 space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="app-card-soft flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-700">{row.label}</p>
          <span className="text-sm font-bold text-cyan-700">{row.value}</span>
        </div>
      ))}
      {!rows.length && <p className="section-note">{emptyText}</p>}
    </div>
  )
}

function RateCard({ label, value }) {
  return (
    <article className="app-card-soft">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{value}%</p>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-cyan-600" style={{ width: `${clamp(value, 0, 100)}%` }} />
      </div>
    </article>
  )
}

function BarTable({ entries }) {
  const max = entries.length ? Math.max(...entries.map(([, value]) => Number(value))) : 0
  return (
    <div className="mt-3 space-y-2">
      {entries.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 flex items-center justify-between text-xs text-slate-600">
            <span>{normalizeLabel(label)}</span>
            <span>{value}</span>
          </div>
          <div className="h-2 rounded bg-slate-200">
            <div
              className="h-2 rounded bg-indigo-500"
              style={{ width: `${max ? Math.round((Number(value) / max) * 100) : 0}%` }}
            />
          </div>
        </div>
      ))}
      {!entries.length && <p className="section-note">No data available.</p>}
    </div>
  )
}

function HeatmapGrid({ entries, normalizeLabels = false }) {
  const max = entries.length ? Math.max(...entries.map(([, value]) => Number(value || 0))) : 0
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {entries.map(([label, count]) => {
        const ratio = max ? Number(count || 0) / max : 0
        const intensity = Math.min(0.92, 0.18 + ratio * 0.74)
        return (
          <div
            key={label}
            className="rounded-lg p-3 text-white"
            style={{ backgroundColor: `rgba(14, 116, 144, ${intensity})` }}
          >
            <p className="text-sm font-semibold">{normalizeLabels ? normalizeLabel(label) : label}</p>
            <p className="text-xs">Volume: {count}</p>
          </div>
        )
      })}
      {!entries.length && <p className="section-note col-span-2">No heatmap data available.</p>}
    </div>
  )
}
