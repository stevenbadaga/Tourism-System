import React, { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { api } from "../api"
import { CATEGORY_OPTIONS, deriveCategory, normalizeLabel } from "../data/tourismData"

export default function AttractionList() {
  const [attractions, setAttractions] = useState([])
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedCity, setSelectedCity] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    Promise.allSettled([api.attractions.list(), api.reviews.list()]).then(([attractionsResult, reviewsResult]) => {
      if (attractionsResult.status === "fulfilled") {
        setAttractions(attractionsResult.value.value || attractionsResult.value || [])
      } else {
        setError("Failed to load attractions.")
      }
      setReviews(reviewsResult.status === "fulfilled" ? reviewsResult.value.value || reviewsResult.value || [] : [])
      setLoading(false)
    })
  }, [])

  const cities = useMemo(
    () => Array.from(new Set(attractions.map((item) => item.city).filter(Boolean))).sort(),
    [attractions],
  )

  const filtered = useMemo(() => {
    return attractions.filter((item) => {
      const category = deriveCategory(item)
      const matchesCity = !selectedCity || item.city === selectedCity
      const matchesCategory = !selectedCategory || category === selectedCategory
      const matchesSearch =
        !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCity && matchesCategory && matchesSearch
    })
  }, [attractions, searchQuery, selectedCategory, selectedCity])

  const reviewStats = useMemo(() => {
    return reviews.reduce((accumulator, review) => {
      const key = review.attraction?.id || review.attractionId
      if (!key) return accumulator
      if (!accumulator[key]) accumulator[key] = { sum: 0, count: 0 }
      accumulator[key].sum += Number(review.rating || 0)
      accumulator[key].count += 1
      return accumulator
    }, {})
  }, [reviews])

  return (
    <div className="page-stage">
      <div className="shell-container space-y-6">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">Destination Information</h1>
          <p className="mt-2 text-slate-200">
            Destination cards with category filters, review ratings, and visitor-ready summaries.
          </p>
        </header>

        <section className="app-card">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search destination name or description"
              className="input-control"
            />
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
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="input-control"
            >
              <option value="">All categories</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category} value={category}>
                  {normalizeLabel(category)}
                </option>
              ))}
            </select>
          </div>
        </section>

        {loading ? (
          <p className="rounded bg-white p-6 text-sm text-slate-600 shadow">Loading destinations...</p>
        ) : (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((item) => {
              const category = deriveCategory(item)
              const stat = reviewStats[item.id]
              const average = stat ? (stat.sum / stat.count).toFixed(1) : "-"
              return (
                <Link
                  key={item.id}
                  to={`/attractions/${item.id}`}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow transition hover:shadow-lg"
                >
                  <p className="text-xs font-semibold uppercase text-slate-500">{normalizeLabel(category)}</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">{item.name}</h3>
                  <p className="mt-1 text-xs text-slate-500">{item.city}</p>
                  <p className="mt-3 text-sm text-slate-600">{item.description}</p>
                  <p className="mt-3 text-xs font-semibold text-indigo-700">
                    Rating: {average} ({stat?.count || 0} reviews)
                  </p>
                </Link>
              )
            })}
            {!filtered.length && (
              <p className="rounded bg-white p-6 text-sm text-slate-600 shadow">No destinations match your filters.</p>
            )}
          </section>
        )}

        {error && <div className="rounded-xl bg-rose-100 p-4 text-sm font-semibold text-rose-700">{error}</div>}
      </div>
    </div>
  )
}
