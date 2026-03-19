import React, { useEffect, useMemo, useState } from "react"
import { useParams } from "react-router-dom"
import { api } from "../api"

export default function Reviews() {
  const { id } = useParams()
  const [attraction, setAttraction] = useState(null)
  const [reviews, setReviews] = useState([])
  const [userId, setUserId] = useState("")
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState("")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadData = () => {
    Promise.allSettled([api.attractions.get(id), api.reviews.list(id)]).then(([attractionResult, reviewResult]) => {
      if (attractionResult.status === "fulfilled") setAttraction(attractionResult.value)
      if (reviewResult.status === "fulfilled") setReviews(reviewResult.value.value || reviewResult.value || [])
      setLoading(false)
    })
  }

  useEffect(() => {
    loadData()
  }, [id])

  const average = useMemo(() => {
    if (!reviews.length) return "0.0"
    return (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
  }, [reviews])

  const submitReview = async (event) => {
    event.preventDefault()
    setError("")
    if (!userId || !comment.trim()) {
      setError("User ID and comment are required.")
      return
    }

    try {
      await api.reviews.create({
        user: { id: Number(userId) },
        attraction: { id: Number(id) },
        rating: Number(rating),
        comment,
      })
      setMessage("Review submitted.")
      setComment("")
      setRating(5)
      setUserId("")
      loadData()
    } catch (requestError) {
      setError("Failed to submit review.")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-600">Loading reviews...</p>
      </div>
    )
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-6">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">{attraction?.name || "Destination"} Reviews</h1>
          <p className="mt-2 text-slate-200">
            Average rating: {average} / 5 ({reviews.length} review{reviews.length !== 1 ? "s" : ""})
          </p>
        </header>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card xl:col-span-2">
            <h2 className="text-lg font-bold text-slate-900">Guest feedback</h2>
            <div className="mt-4 space-y-3">
              {reviews.map((review) => (
                <article key={review.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">{review.user?.username || "Traveler"}</p>
                  <p className="text-xs text-slate-500">Rating: {review.rating} / 5</p>
                  <p className="mt-1 text-sm text-slate-700">{review.comment}</p>
                </article>
              ))}
              {!reviews.length && <p className="text-sm text-slate-500">No reviews yet.</p>}
            </div>
          </section>

          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Write a review</h2>
            <form className="mt-3 space-y-3" onSubmit={submitReview}>
              <input
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="User ID"
                className="input-control"
              />
              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
                className="input-control"
              >
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Share your experience"
                className="input-control h-24"
              />
              <button type="submit" className="btn-primary w-full">
                Submit review
              </button>
            </form>
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
