import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { CATEGORY_OPTIONS, estimateTravelMinutes, getDestinationMetadata, normalizeLabel } from "../data/tourismData"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const PRIORITY_CATEGORIES = ["national-parks", "museums", "markets", "restaurants"]
const LANGUAGE_OPTIONS = ["English", "French", "Kinyarwanda"]

function toCanvasPoint(coordinates) {
  const minLat = -2.8
  const maxLat = -1.1
  const minLng = 28.7
  const maxLng = 30.6
  const x = ((coordinates.lng - minLng) / (maxLng - minLng)) * 100
  const y = (1 - (coordinates.lat - minLat) / (maxLat - minLat)) * 100
  return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) }
}

function distanceMinutes(fromPoint, toPoint) {
  return estimateTravelMinutes(fromPoint, toPoint, "walk")
}

function getInitials(name) {
  return String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((value) => value[0]?.toUpperCase() || "")
    .join("")
}

function parseDate(value) {
  if (!value) return "N/A"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function averageRating(reviews) {
  if (!reviews.length) return 0
  return reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
}

function roundedStars(value) {
  return "★".repeat(Math.max(0, Math.round(value))).padEnd(5, "☆")
}

function localizedSummary(destination, language) {
  const categoryLabel = normalizeLabel(destination.category)
  const base = destination.description || `${destination.name} is one of the highlighted destinations in ${destination.city}.`
  if (language === "French") {
    return `Explorez ${destination.name} a ${destination.city}. Ce guide ${categoryLabel.toLowerCase()} inclut les points forts, les horaires de visite et les conseils culturels pour mieux preparer votre sejour.`
  }
  if (language === "Kinyarwanda") {
    return `${destination.name} iherereye i ${destination.city}. Uru rugendo rwa ${categoryLabel.toLowerCase()} rugufasha kubona ibisobanuro by'ingenzi, amasaha yo gusura, n'inama z'umuco.`
  }
  return base
}

function localizedEtiquette(destination, language) {
  if (language === "English" && destination.etiquetteTips?.length) return destination.etiquetteTips
  if (language === "French") {
    return [
      "Saluez les habitants avec politesse avant de commencer une conversation.",
      "Demandez toujours l'autorisation avant de prendre des photos des personnes.",
      "Respectez les zones protegees et suivez les indications locales.",
    ]
  }
  if (language === "Kinyarwanda") {
    return [
      "Tangira ugira ikinyabupfura mu gusuhuza mbere yo gusaba ubufasha.",
      "Banza usabe uburenganzira mbere yo gufotora abantu.",
      "Kubahiriza amabwiriza y'aho wasuye no kurinda ibidukikije.",
    ]
  }
  return destination.etiquetteTips?.length
    ? destination.etiquetteTips
    : ["Respect local guidance and preserve cultural spaces during your visit."]
}

function extractCommunityTips(reviews) {
  const unique = new Set()
  const tips = []
  reviews.forEach((review) => {
    const comment = String(review.comment || "").trim()
    if (comment.length < 18) return
    const snippet = comment.length > 110 ? `${comment.slice(0, 110)}...` : comment
    const normalized = snippet.toLowerCase()
    if (unique.has(normalized)) return
    unique.add(normalized)
    tips.push(snippet)
  })
  return tips.slice(0, 4)
}

function buildCategoryOptions(destinations) {
  const set = new Set([...PRIORITY_CATEGORIES, ...CATEGORY_OPTIONS])
  destinations.forEach((destination) => set.add(destination.category))
  const dynamic = Array.from(set).filter((value) => !PRIORITY_CATEGORIES.includes(value))
  return ["all", ...PRIORITY_CATEGORIES, ...dynamic]
}

export default function Map() {
  const [attractions, setAttractions] = useState([])
  const [users, setUsers] = useState([])
  const [selectedDestinationId, setSelectedDestinationId] = useState(() =>
    readStoredJson("tourism-destination-selected", ""),
  )
  const [categoryFilter, setCategoryFilter] = useState(() =>
    readStoredJson("tourism-destination-category-filter", "all"),
  )
  const [searchText, setSearchText] = useState("")
  const [language, setLanguage] = useState(() => readStoredJson("tourism-destination-language", "English"))
  const [savedPlaces, setSavedPlaces] = useState(() => readStoredJson("tourism-destination-saved-places", []))
  const [offlineSnapshotAt, setOfflineSnapshotAt] = useState(() =>
    readStoredJson("tourism-destination-offline-ts", "Never"),
  )
  const [reviews, setReviews] = useState([])
  const [reviewLoading, setReviewLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewDraft, setReviewDraft] = useState({
    userId: "",
    rating: 5,
    comment: "",
  })
  const [galleryIndex, setGalleryIndex] = useState(0)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [offlineMode, setOfflineMode] = useState(false)

  useEffect(() => {
    writeStoredJson("tourism-destination-selected", selectedDestinationId)
  }, [selectedDestinationId])

  useEffect(() => {
    writeStoredJson("tourism-destination-category-filter", categoryFilter)
  }, [categoryFilter])

  useEffect(() => {
    writeStoredJson("tourism-destination-language", language)
  }, [language])

  useEffect(() => {
    writeStoredJson("tourism-destination-saved-places", savedPlaces)
  }, [savedPlaces])

  useEffect(() => {
    let cancelled = false
    const offlinePackage = readStoredJson("tourism-destination-offline-cache", null)

    Promise.allSettled([api.attractions.list(), api.users.list()])
      .then(([attractionResult, usersResult]) => {
        if (cancelled) return

        if (attractionResult.status === "fulfilled") {
          const list = attractionResult.value.value || attractionResult.value || []
          setAttractions(list)
          setOfflineMode(false)
        } else if (offlinePackage?.attractions?.length) {
          setAttractions(offlinePackage.attractions)
          if (Array.isArray(offlinePackage.savedPlaces)) {
            setSavedPlaces(offlinePackage.savedPlaces)
          }
          if (LANGUAGE_OPTIONS.includes(offlinePackage.language)) {
            setLanguage(offlinePackage.language)
          }
          if (typeof offlinePackage.categoryFilter === "string" && offlinePackage.categoryFilter.trim()) {
            setCategoryFilter(offlinePackage.categoryFilter)
          }
          if (typeof offlinePackage.selectedDestinationId === "string") {
            setSelectedDestinationId(offlinePackage.selectedDestinationId)
          }
          if (offlinePackage.reviewsCache && typeof offlinePackage.reviewsCache === "object") {
            writeStoredJson("tourism-destination-reviews-cache", offlinePackage.reviewsCache)
          }
          if (offlinePackage.snapshotAt) {
            writeStoredJson("tourism-destination-offline-ts", offlinePackage.snapshotAt)
            setOfflineSnapshotAt(offlinePackage.snapshotAt)
          }
          setOfflineMode(true)
          setMessage("Loaded offline destination data package.")
        } else {
          setAttractions([])
          setError("Could not load destination data.")
        }

        if (usersResult.status === "fulfilled") {
          const list = usersResult.value.value || usersResult.value || []
          setUsers(list)
          if (list.length && !reviewDraft.userId) {
            setReviewDraft((current) => ({ ...current, userId: String(list[0].id) }))
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const destinations = useMemo(
    () =>
      attractions.map((attraction) => {
        const metadata = getDestinationMetadata(attraction)
        return {
          id: `attraction-${attraction.id}`,
          attractionId: attraction.id,
          name: attraction.name,
          city: attraction.city,
          description: attraction.description || `${attraction.name} is one of the highlighted places in ${attraction.city}.`,
          category: metadata.category,
          coordinates: metadata.coordinates,
          hours: metadata.hours,
          entryFeeUsd: metadata.entryFeeUsd,
          bestTime: metadata.bestTime,
          highlights: metadata.highlights || [],
          etiquetteTips: metadata.etiquetteTips || [],
          images: metadata.images || [],
          virtualTourUrl: metadata.virtualTourUrl,
        }
      }),
    [attractions],
  )

  const categoryOptions = useMemo(() => buildCategoryOptions(destinations), [destinations])

  const visibleDestinations = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return destinations.filter((destination) => {
      const categoryMatch = categoryFilter === "all" || destination.category === categoryFilter
      const searchMatch =
        !keyword ||
        `${destination.name} ${destination.city} ${destination.category}`
          .toLowerCase()
          .includes(keyword)
      return categoryMatch && searchMatch
    })
  }, [categoryFilter, destinations, searchText])

  useEffect(() => {
    if (!visibleDestinations.length) return
    const selectedVisible = visibleDestinations.some((destination) => destination.id === selectedDestinationId)
    if (!selectedDestinationId || !selectedVisible) {
      setSelectedDestinationId(visibleDestinations[0].id)
    }
  }, [selectedDestinationId, visibleDestinations])

  const selectedDestination = useMemo(
    () => destinations.find((destination) => destination.id === selectedDestinationId) || visibleDestinations[0] || null,
    [destinations, selectedDestinationId, visibleDestinations],
  )

  useEffect(() => {
    setGalleryIndex(0)
  }, [selectedDestinationId])

  useEffect(() => {
    if (!selectedDestination?.attractionId) {
      setReviews([])
      return
    }

    let cancelled = false
    const reviewsCache = readStoredJson("tourism-destination-reviews-cache", {})
    setReviewLoading(true)

    api.reviews
      .list(selectedDestination.attractionId)
      .then((data) => {
        if (cancelled) return
        const list = data.value || data || []
        setReviews(list)
        writeStoredJson("tourism-destination-reviews-cache", {
          ...reviewsCache,
          [selectedDestination.attractionId]: list,
        })
      })
      .catch(() => {
        if (cancelled) return
        setReviews(reviewsCache[selectedDestination.attractionId] || [])
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [selectedDestination?.attractionId])

  const nearbySuggestions = useMemo(() => {
    if (!selectedDestination) return []
    return destinations
      .filter((destination) => destination.id !== selectedDestination.id)
      .map((destination) => ({
        ...destination,
        minutes: distanceMinutes(selectedDestination.coordinates, destination.coordinates),
      }))
      .sort((a, b) => a.minutes - b.minutes)
      .slice(0, 6)
  }, [destinations, selectedDestination])

  const topDestinationCards = useMemo(() => visibleDestinations.slice(0, 4), [visibleDestinations])
  const reviewAverage = useMemo(() => averageRating(reviews), [reviews])
  const reviewTips = useMemo(() => extractCommunityTips(reviews), [reviews])
  const activeImage = selectedDestination?.images?.[galleryIndex] || selectedDestination?.images?.[0] || null
  const localizedDescription = selectedDestination ? localizedSummary(selectedDestination, language) : ""
  const etiquetteTips = selectedDestination ? localizedEtiquette(selectedDestination, language) : []

  const savePlace = (destination) => {
    const nextEntry = {
      id: destination.id,
      name: destination.name,
      city: destination.city,
      category: destination.category,
      savedAt: new Date().toISOString(),
    }
    setSavedPlaces((current) => [nextEntry, ...current.filter((item) => item.id !== destination.id)].slice(0, 20))
    setMessage(`${destination.name} added to saved destinations.`)
    setError("")
  }

  const saveOfflineSnapshot = () => {
    const reviewsCache = readStoredJson("tourism-destination-reviews-cache", {})
    const ts = new Date().toLocaleString()
    writeStoredJson("tourism-destination-offline-cache", {
      attractions,
      savedPlaces,
      language,
      categoryFilter,
      selectedDestinationId,
      reviewsCache,
      snapshotAt: ts,
    })
    writeStoredJson("tourism-destination-offline-ts", ts)
    setOfflineSnapshotAt(ts)
    setMessage("Offline destination package saved.")
    setError("")
  }

  const submitReview = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!selectedDestination?.attractionId) {
      setError("Select a destination linked to attraction data before posting a review.")
      return
    }
    if (!reviewDraft.userId || !reviewDraft.comment.trim()) {
      setError("Reviewer and comment are required.")
      return
    }

    setSubmittingReview(true)
    try {
      await api.reviews.create({
        user: { id: Number(reviewDraft.userId) },
        attraction: { id: Number(selectedDestination.attractionId) },
        rating: Number(reviewDraft.rating),
        comment: reviewDraft.comment.trim(),
      })
      const latest = await api.reviews.list(selectedDestination.attractionId)
      const list = latest.value || latest || []
      setReviews(list)
      const reviewsCache = readStoredJson("tourism-destination-reviews-cache", {})
      writeStoredJson("tourism-destination-reviews-cache", {
        ...reviewsCache,
        [selectedDestination.attractionId]: list,
      })
      setReviewDraft((current) => ({ ...current, rating: 5, comment: "" }))
      setMessage("Review submitted successfully.")
    } catch (requestError) {
      setError("Could not submit review.")
    } finally {
      setSubmittingReview(false)
    }
  }

  if (loading) {
    return (
      <div className="page-stage">
        <div className="shell-container">
          <div className="app-card text-sm text-slate-600">Loading destination intelligence...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-6 pb-8">
        <header className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Destination Module</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Interactive Destination Information Hub</h1>
          <p className="mt-3 max-w-3xl text-sm text-cyan-50 md:text-base">
            Rich destination guides, multimedia details, crowd-sourced reviews, nearby suggestions, and offline-ready
            travel information in one workspace.
          </p>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-3">
            <div className="stat-chip">
              <p className="text-lg font-bold">{destinations.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Destinations</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{visibleDestinations.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Visible POIs</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{offlineSnapshotAt === "Never" ? "No" : "Yes"}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Offline Package</p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[330px_1fr]">
          <aside className="space-y-4">
            <section className="app-card">
              <h2 className="section-title text-lg">Destination Filters</h2>
              <p className="section-note">Category filter, language toggle, and quick search.</p>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Language
                </label>
                <select value={language} onChange={(event) => setLanguage(event.target.value)} className="input-control">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3">
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  Search destination
                </label>
                <input
                  className="input-control"
                  placeholder="Search by name, city, or category"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {categoryOptions.map((option) => (
                  <button
                    type="button"
                    key={option}
                    onClick={() => setCategoryFilter(option)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      categoryFilter === option
                        ? "bg-cyan-700 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {normalizeLabel(option)}
                  </button>
                ))}
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Offline Destination Access</h2>
              <p className="section-note">Last snapshot: {offlineSnapshotAt}</p>
              <button type="button" onClick={saveOfflineSnapshot} className="btn-primary mt-3 w-full">
                Save Offline Package
              </button>
              <p className="mt-2 text-xs text-slate-500">
                Includes destination info, selected language, reviews cache, and saved places.
              </p>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Saved Destinations</h2>
              <div className="mt-3 max-h-44 space-y-2 overflow-auto text-xs">
                {savedPlaces.map((place) => (
                  <div key={place.id} className="app-card-soft">
                    <p className="font-semibold text-slate-700">{place.name}</p>
                    <p className="text-slate-500">
                      {place.city} | {normalizeLabel(place.category)}
                    </p>
                    <p className="text-slate-400">Saved: {parseDate(place.savedAt)}</p>
                  </div>
                ))}
                {!savedPlaces.length && <p className="section-note">Use destination cards or markers to save places.</p>}
              </div>
            </section>
          </aside>

          <section className="space-y-5">
            <section className="app-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-title text-lg">Interactive Destination Map</h2>
                  <p className="section-note">POI markers update with category and search filters.</p>
                </div>
                {offlineMode && <span className="chip">Offline mode</span>}
              </div>

              <div className="relative h-[520px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-cyan-100 via-sky-50 to-emerald-100">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,116,144,0.2),transparent_40%),radial-gradient(circle_at_80%_40%,rgba(5,150,105,0.16),transparent_35%)]" />
                {visibleDestinations.map((destination) => {
                  const canvas = toCanvasPoint(destination.coordinates)
                  const active = destination.id === selectedDestination?.id
                  return (
                    <button
                      key={destination.id}
                      type="button"
                      title={`${destination.name} (${destination.city})`}
                      style={{ left: `${canvas.x}%`, top: `${canvas.y}%` }}
                      onClick={() => setSelectedDestinationId(destination.id)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 text-[11px] font-semibold shadow transition ${
                        active
                          ? "h-10 w-10 border-cyan-700 bg-cyan-700 text-white"
                          : "h-8 w-8 border-white bg-slate-800/85 text-slate-50 hover:scale-105"
                      }`}
                    >
                      {getInitials(destination.name)}
                    </button>
                  )
                })}

                {!visibleDestinations.length && (
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-slate-600">
                    No destinations match this filter.
                  </div>
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Nearby Attractions</h2>
              <p className="section-note">Suggestions around the selected destination.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {nearbySuggestions.map((destination) => (
                  <button
                    type="button"
                    key={`${destination.id}-nearby`}
                    onClick={() => setSelectedDestinationId(destination.id)}
                    className="app-card-soft text-left transition hover:border-cyan-200 hover:bg-cyan-50"
                  >
                    <p className="text-sm font-semibold text-slate-700">{destination.name}</p>
                    <p className="text-xs text-slate-500">
                      {destination.city} | {normalizeLabel(destination.category)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-cyan-700">{destination.minutes} min walk estimate</p>
                  </button>
                ))}
                {!nearbySuggestions.length && <p className="section-note">Select a destination to get nearby suggestions.</p>}
              </div>
            </section>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <section className="app-card">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="section-title text-lg">Destination Detail Guide</h2>
                <p className="section-note">Multimedia overview, visitor info, and etiquette guidance.</p>
              </div>
              {selectedDestination && (
                <button type="button" onClick={() => savePlace(selectedDestination)} className="btn-secondary">
                  Save Destination
                </button>
              )}
            </div>

            {selectedDestination ? (
              <div className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    {activeImage ? (
                      <img
                        src={activeImage}
                        alt={`${selectedDestination.name} gallery`}
                        className="h-60 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-60 items-center justify-center text-sm text-slate-500">No media available</div>
                    )}
                    {selectedDestination.images?.length > 1 && (
                      <div className="grid grid-cols-4 gap-1 p-2">
                        {selectedDestination.images.slice(0, 4).map((image, index) => (
                          <button
                            type="button"
                            key={image}
                            onClick={() => setGalleryIndex(index)}
                            className={`overflow-hidden rounded border ${
                              index === galleryIndex ? "border-cyan-600" : "border-transparent"
                            }`}
                          >
                            <img src={image} alt={`${selectedDestination.name} thumbnail ${index + 1}`} className="h-12 w-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="app-card-soft space-y-3">
                    <div>
                      <h3 className="text-base font-semibold text-slate-800">{selectedDestination.name}</h3>
                      <p className="text-xs text-slate-500">
                        {selectedDestination.city} | {normalizeLabel(selectedDestination.category)}
                      </p>
                    </div>
                    <p className="text-sm text-slate-700">{localizedDescription}</p>
                    <a
                      href={selectedDestination.virtualTourUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-primary w-full"
                    >
                      Open 360 Virtual Tour
                    </a>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="app-card-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Visitor Information</p>
                    <p className="mt-2 text-sm text-slate-700">Hours: {selectedDestination.hours}</p>
                    <p className="text-sm text-slate-700">Fee: ${selectedDestination.entryFeeUsd} USD</p>
                    <p className="text-sm text-slate-700">Best time: {selectedDestination.bestTime}</p>
                  </div>
                  <div className="app-card-soft">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Highlights</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedDestination.highlights.map((highlight) => (
                        <span key={highlight} className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="app-card-soft">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Cultural and Etiquette Tips</p>
                  <ul className="mt-2 space-y-1 text-sm text-slate-700">
                    {etiquetteTips.map((tip) => (
                      <li key={tip} className="rounded-lg bg-white px-3 py-2">
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="section-note">Select a destination marker to view details.</p>
            )}
          </section>

          <section className="space-y-5">
            <section className="app-card">
              <h2 className="section-title text-lg">Reviews and Ratings</h2>
              <div className="mt-3 app-card-soft">
                <p className="text-sm font-semibold text-slate-700">
                  Average: {reviewAverage.toFixed(1)} / 5 {roundedStars(reviewAverage)}
                </p>
                <p className="text-xs text-slate-500">
                  {reviews.length} review{reviews.length !== 1 ? "s" : ""} for this destination
                </p>
              </div>

              <div className="mt-3 max-h-48 space-y-2 overflow-auto text-sm">
                {reviewLoading && <p className="section-note">Loading reviews...</p>}
                {!reviewLoading &&
                  reviews.map((review) => (
                    <article key={review.id} className="app-card-soft">
                      <p className="font-semibold text-slate-700">{review.user?.username || "Traveler"}</p>
                      <p className="text-xs text-slate-500">
                        {review.rating}/5 | {parseDate(review.createdAt)}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{review.comment}</p>
                    </article>
                  ))}
                {!reviewLoading && !reviews.length && <p className="section-note">No reviews yet.</p>}
              </div>

              <div className="mt-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Community Tips</p>
                <div className="space-y-2">
                  {reviewTips.map((tip) => (
                    <p key={tip} className="app-card-soft text-xs text-slate-600">
                      {tip}
                    </p>
                  ))}
                  {!reviewTips.length && <p className="section-note">Tips will appear from crowd-sourced reviews.</p>}
                </div>
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Share a Review</h2>
              <form className="mt-3 space-y-2" onSubmit={submitReview}>
                <select
                  className="input-control"
                  value={reviewDraft.userId}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, userId: event.target.value }))}
                >
                  {!users.length && <option value="">No users available</option>}
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
                <select
                  className="input-control"
                  value={reviewDraft.rating}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, rating: Number(event.target.value) }))}
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>
                      {value} / 5
                    </option>
                  ))}
                </select>
                <textarea
                  className="input-control min-h-[110px]"
                  placeholder="Share tips for future travelers"
                  value={reviewDraft.comment}
                  onChange={(event) => setReviewDraft((current) => ({ ...current, comment: event.target.value }))}
                />
                <button type="submit" disabled={submittingReview} className="btn-primary w-full">
                  {submittingReview ? "Submitting..." : "Submit review"}
                </button>
              </form>
            </section>
          </section>
        </div>

        <section className="app-card">
          <h2 className="section-title text-lg">Destination Detail Cards</h2>
          <p className="section-note">Quick cards for the currently filtered destinations.</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {topDestinationCards.map((destination) => (
              <article key={`${destination.id}-card`} className="app-card-soft">
                {destination.images?.[0] && (
                  <img
                    src={destination.images[0]}
                    alt={`${destination.name} cover`}
                    className="h-28 w-full rounded-lg object-cover"
                  />
                )}
                <h3 className="mt-2 text-sm font-semibold text-slate-800">{destination.name}</h3>
                <p className="text-xs text-slate-500">
                  {destination.city} | {normalizeLabel(destination.category)}
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDestinationId(destination.id)}
                    className="btn-secondary flex-1"
                  >
                    View
                  </button>
                  <button type="button" onClick={() => savePlace(destination)} className="btn-primary flex-1">
                    Save
                  </button>
                </div>
              </article>
            ))}
            {!topDestinationCards.length && <p className="section-note md:col-span-2 xl:col-span-4">No destinations to display.</p>}
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
