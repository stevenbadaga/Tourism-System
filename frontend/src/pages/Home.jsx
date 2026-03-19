import React, { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api"

const MODULE_LINKS = [
  { title: "User Profile", path: "/profile", note: "Preferences, interests, privacy, travel history" },
  { title: "Destination Info", path: "/attractions", note: "Cards, categories, reviews, media" },
  { title: "Recommendations", path: "/recommendations", note: "Personalized feed and discover cards" },
  { title: "Notifications", path: "/notifications", note: "Weather, traffic, safety, emergency" },
  { title: "Itinerary Builder", path: "/itineraries", note: "Scheduling, budget, conflicts, route optimize" },
  { title: "Booking Center", path: "/bookings", note: "Hotels, tours, transport, checkout" },
  { title: "Analytics", path: "/analytics", note: "Engagement, funnel, heatmaps, exports" },
  { title: "Auth and Access", path: "/auth", note: "Login, role access, MFA, consent" },
  { title: "Interactive Map", path: "/map", note: "Layers, routing, offline map, nearby radar" },
  { title: "Community", path: "/community", note: "Feed, Ask a Local, buddy finder, messaging" },
]

const LIVE_PAGE_PATHS = [
  "/",
  "/attractions",
  "/attractions/:id",
  "/attractions/:id/reviews",
  "/recommendations",
  "/dashboard",
  "/profile",
  "/itineraries",
  "/map",
  "/notifications",
  "/bookings",
  "/analytics",
  "/auth",
  "/community",
]
const LIVE_PAGE_COUNT = LIVE_PAGE_PATHS.length
const TRAVEL_WORKFLOW_COUNT = MODULE_LINKS.reduce((total, module) => {
  const count = module.note
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean).length
  return total + count
}, 0)
const LIVE_STAT_REFRESH_MS = 60_000

function toList(data) {
  const value = data?.value || data || []
  return Array.isArray(value) ? value : []
}

export default function Home() {
  const [featured, setFeatured] = useState([])
  const [liveStats, setLiveStats] = useState({
    modules: MODULE_LINKS.length,
    pages: LIVE_PAGE_COUNT,
    workflows: TRAVEL_WORKFLOW_COUNT,
  })

  useEffect(() => {
    api.attractions
      .list()
      .then((data) => setFeatured((data.value || data || []).slice(0, 4)))
      .catch(() => setFeatured([]))
  }, [])

  useEffect(() => {
    let active = true

    const refreshStats = async () => {
      const [bookingResult, itineraryResult, recommendationResult] = await Promise.allSettled([
        api.bookings.list(),
        api.itineraries.list(),
        api.recommendations.list(),
      ])

      if (!active) return

      const hasLiveWorkflowData =
        bookingResult.status === "fulfilled" ||
        itineraryResult.status === "fulfilled" ||
        recommendationResult.status === "fulfilled"

      const bookingCount = bookingResult.status === "fulfilled" ? toList(bookingResult.value).length : 0
      const itineraryCount = itineraryResult.status === "fulfilled" ? toList(itineraryResult.value).length : 0
      const recommendationCount =
        recommendationResult.status === "fulfilled" ? toList(recommendationResult.value).length : 0

      setLiveStats({
        modules: MODULE_LINKS.length,
        pages: LIVE_PAGE_COUNT,
        workflows: hasLiveWorkflowData
          ? bookingCount + itineraryCount + recommendationCount
          : TRAVEL_WORKFLOW_COUNT,
      })
    }

    refreshStats()
    const timer = window.setInterval(refreshStats, LIVE_STAT_REFRESH_MS)

    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const quickStats = useMemo(
    () => [
      { label: "Core Modules", value: String(liveStats.modules) },
      { label: "Live Pages", value: String(liveStats.pages) },
      { label: "Travel Workflows", value: String(liveStats.workflows) },
    ],
    [liveStats],
  )

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8 pb-8">
        <section className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Rwanda Tourism Platform</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight md:text-5xl">
            Professional intelligent travel operations for tourists, agents, and operators
          </h1>
          <p className="mt-4 max-w-3xl text-sm text-cyan-50 md:text-base">
            Unified destination discovery, recommendations, bookings, route planning, and analytics for
            Sanderling Travel and Tours.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/recommendations" className="btn-primary">Start with recommendations</Link>
            <Link to="/map" className="btn-secondary border-white/60 bg-white/10 text-white hover:bg-white/20">Open interactive map</Link>
          </div>
          <div className="mt-8 grid gap-2 sm:grid-cols-3">
            {quickStats.map((item) => (
              <div key={item.label} className="stat-chip">
                <p className="text-lg font-bold">{item.value}</p>
                <p className="text-xs">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">System Modules</h2>
              <p className="section-note">Each module is production-styled with consistent UX patterns.</p>
            </div>
            <Link to="/auth" className="btn-secondary">Access & roles</Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {MODULE_LINKS.map((module) => (
              <Link
                key={module.title}
                to={module.path}
                className="app-card-soft transition hover:-translate-y-0.5 hover:shadow"
              >
                <p className="text-base font-semibold text-slate-900">{module.title}</p>
                <p className="mt-1 text-sm text-slate-600">{module.note}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="app-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="section-title">Featured Destinations</h2>
              <p className="section-note">Direct links to active destinations and booking flows.</p>
            </div>
            <Link to="/attractions" className="btn-secondary">View all destinations</Link>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {featured.map((item) => (
              <Link key={item.id} to={`/attractions/${item.id}`} className="app-card-soft transition hover:shadow">
                <p className="text-base font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-cyan-700">{item.city}</p>
                <p className="mt-2 text-sm text-slate-600 line-clamp-3">{item.description}</p>
              </Link>
            ))}
            {!featured.length && <p className="text-sm text-slate-500">No featured attractions available.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}
