import React, { useEffect, useMemo, useState } from "react"
import { useParams, Link } from "react-router-dom"
import { api } from "../api"
import { getDestinationMetadata, normalizeLabel } from "../data/tourismData"
import { appendStoredItem, readStoredJson, writeStoredJson } from "../utils/storage"

const TRANSLATIONS = {
  en: {
    title: "Destination details",
    visitorInfo: "Visitor information",
    nearby: "Nearby attractions",
    book: "Book this destination",
    reviews: "Community reviews",
    saveOffline: "Save for offline access",
    gallery: "Photo gallery",
    tips: "Cultural and etiquette tips",
  },
  rw: {
    title: "Ibisobanuro by'ahantu",
    visitorInfo: "Amakuru y'abashyitsi",
    nearby: "Ahandi hegereye",
    book: "Bika uru rugendo",
    reviews: "Isuzuma ry'abagenzi",
    saveOffline: "Bika ngo uzabikoreshe offline",
    gallery: "Amafoto",
    tips: "Inama z'umuco n'imyitwarire",
  },
}

export default function AttractionDetail() {
  const { id } = useParams()
  const [attraction, setAttraction] = useState(null)
  const [attractions, setAttractions] = useState([])
  const [reviews, setReviews] = useState([])
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState("")
  const [bookingDate, setBookingDate] = useState("")
  const [language, setLanguage] = useState("en")
  const [bookingMessage, setBookingMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.allSettled([
      api.attractions.get(id),
      api.attractions.list(),
      api.users.list(),
      api.reviews.list(id),
    ]).then(([attractionResult, attractionsResult, usersResult, reviewResult]) => {
      if (attractionResult.status !== "fulfilled") {
        setError("Destination not found.")
        setLoading(false)
        return
      }

      const selected = attractionResult.value
      setAttraction(selected)
      setAttractions(
        attractionsResult.status === "fulfilled"
          ? attractionsResult.value.value || attractionsResult.value || []
          : [],
      )
      setUsers(usersResult.status === "fulfilled" ? usersResult.value.value || usersResult.value || [] : [])
      setReviews(reviewResult.status === "fulfilled" ? reviewResult.value.value || reviewResult.value || [] : [])
      setLoading(false)

      const currentViewMap = readStoredJson("tourism-attraction-views", {})
      writeStoredJson("tourism-attraction-views", {
        ...currentViewMap,
        [selected.id]: (currentViewMap[selected.id] || 0) + 1,
      })
    })
  }, [id])

  const labels = TRANSLATIONS[language]
  const metadata = useMemo(() => (attraction ? getDestinationMetadata(attraction) : null), [attraction])

  const nearbyAttractions = useMemo(() => {
    if (!attraction) return []
    return attractions
      .filter((item) => item.city === attraction.city && String(item.id) !== String(attraction.id))
      .slice(0, 4)
  }, [attraction, attractions])

  const averageRating = useMemo(() => {
    if (!reviews.length) return 0
    const value = reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    return value.toFixed(1)
  }, [reviews])

  const saveOffline = () => {
    if (!attraction || !metadata) return
    const next = appendStoredItem("tourism-offline-destinations", {
      id: attraction.id,
      name: attraction.name,
      city: attraction.city,
      description: attraction.description,
      metadata,
      savedAt: new Date().toISOString(),
    })
    setBookingMessage(`Saved offline. ${next.length} destination(s) available offline.`)
  }

  const handleBooking = async (event) => {
    event.preventDefault()
    setError("")
    if (!selectedUser || !bookingDate) {
      setError("Select user and booking date.")
      return
    }

    try {
      await api.bookings.create(Number(selectedUser), Number(id), bookingDate)
      setBookingMessage("Booking confirmed and e-ticket entry created.")
      setSelectedUser("")
      setBookingDate("")
    } catch (requestError) {
      setError("Booking failed. Please retry.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading destination...</p>
      </div>
    )
  }

  if (!attraction || error) {
    return (
      <div className="page-stage">
        <div className="mx-auto max-w-5xl px-4">
          <p className="rounded bg-rose-100 p-4 text-sm font-semibold text-rose-700">{error || "Not found"}</p>
          <Link to="/attractions" className="mt-4 inline-block text-sm font-semibold text-indigo-700">
            Back to destinations
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/attractions" className="text-sm font-semibold text-indigo-700">
            Back to destinations
          </Link>
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value)}
            className="input-control"
          >
            <option value="en">English</option>
            <option value="rw">Kinyarwanda</option>
          </select>
        </div>

        <header className="overflow-hidden rounded-2xl bg-white shadow-xl">
          <div className="grid gap-6 p-6 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-500">{labels.title}</p>
              <h1 className="mt-2 text-3xl font-bold text-slate-900">{attraction.name}</h1>
              <p className="mt-2 text-sm text-slate-600">{attraction.description}</p>
              <p className="mt-2 text-xs text-slate-500">
                City: {attraction.city} | Category: {normalizeLabel(metadata.category)}
              </p>
              <div className="mt-4 flex gap-2">
                <Link
                  to={`/attractions/${id}/reviews`}
                  className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  Open review page
                </Link>
                <button
                  type="button"
                  onClick={saveOffline}
                  className="rounded bg-emerald-600 px-3 py-2 text-xs font-semibold text-white"
                >
                  {labels.saveOffline}
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{labels.visitorInfo}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>Hours: {metadata.hours}</li>
                <li>Entry fee: ${metadata.entryFeeUsd}</li>
                <li>Best time: {metadata.bestTime}</li>
                <li>Highlights: {metadata.highlights.join(", ")}</li>
              </ul>
            </div>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card xl:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">{labels.gallery}</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {metadata.images.map((image, index) => (
                <img
                  key={`${image}-${index}`}
                  src={image}
                  alt={`${attraction.name} ${index + 1}`}
                  className="h-36 w-full rounded object-cover"
                />
              ))}
            </div>
            <a
              href={metadata.virtualTourUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-xs font-semibold text-indigo-700"
            >
              Open 360 virtual tour link
            </a>
          </section>

          <section className="space-y-6">
            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">{labels.reviews}</h2>
              <p className="mt-1 text-sm text-slate-600">Average rating: {averageRating} / 5</p>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                {reviews.slice(0, 3).map((review) => (
                  <div key={review.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                    <p className="font-semibold text-slate-700">{review.user?.username || "Traveler"}</p>
                    <p>Rating: {review.rating}</p>
                    <p>{review.comment}</p>
                  </div>
                ))}
                {!reviews.length && <p>No reviews yet.</p>}
              </div>
            </div>

            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">{labels.tips}</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
                {metadata.etiquetteTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">{labels.nearby}</h2>
            <div className="mt-3 space-y-2 text-sm">
              {nearbyAttractions.map((item) => (
                <Link
                  key={item.id}
                  to={`/attractions/${item.id}`}
                  className="block rounded border border-slate-200 bg-slate-50 p-3 text-slate-700"
                >
                  {item.name}
                </Link>
              ))}
              {!nearbyAttractions.length && <p className="text-slate-500">No nearby attractions listed yet.</p>}
            </div>
          </section>

          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">{labels.book}</h2>
            <form className="mt-3 space-y-3" onSubmit={handleBooking}>
              <select
                value={selectedUser}
                onChange={(event) => setSelectedUser(event.target.value)}
                className="input-control"
              >
                <option value="">Select traveler</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
              <input
                type="date"
                value={bookingDate}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(event) => setBookingDate(event.target.value)}
                className="input-control"
              />
              <button type="submit" className="btn-primary w-full">
                Confirm booking
              </button>
            </form>
          </section>
        </div>

        {(bookingMessage || error) && (
          <div
            className={`rounded-xl p-4 text-sm font-semibold ${
              error ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {error || bookingMessage}
          </div>
        )}
      </div>
    </div>
  )
}
