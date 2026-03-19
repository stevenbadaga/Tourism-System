import React, { useMemo, useState } from "react"
import { appendStoredItem, readStoredJson, writeStoredJson } from "../utils/storage"

const INITIAL_POSTS = [
  {
    id: "post-1",
    author: "Aline",
    title: "Sunrise in Musanze",
    body: "Best viewpoint was open from 06:00. Carry a light jacket.",
    photo: "https://images.unsplash.com/photo-1589395937772-f670d6f7467d?auto=format&fit=crop&w=900&q=80",
    likes: 12,
    comments: ["Amazing tip!", "Was transport easy to find?"],
  },
  {
    id: "post-2",
    author: "Jonas",
    title: "Kigali food trail",
    body: "Three local places in one afternoon walk. Family friendly options available.",
    photo: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80",
    likes: 19,
    comments: ["Adding this to my itinerary."],
  },
]

const INITIAL_QUESTIONS = [
  { id: "q-1", question: "What is the best day for Nyamirambo market?", answer: "Friday mornings are best." },
  { id: "q-2", question: "Any easy hiking trail for beginners?", answer: "Try the Lake Kivu ridge loop." },
]

const BADGES = [
  { label: "Explorer", condition: "3 posts shared" },
  { label: "Helper", condition: "5 answers in Ask a Local" },
  { label: "Photographer", condition: "10 photo likes" },
]

const COMMUNITY_GUIDELINES = [
  "Share accurate travel info and mention dates when possible.",
  "Respect privacy and do not post personal contact details publicly.",
  "Use friendly language and avoid discriminatory content.",
]

export default function Community() {
  const [posts, setPosts] = useState(() => readStoredJson("tourism-community-posts", INITIAL_POSTS))
  const [questions, setQuestions] = useState(() => readStoredJson("tourism-community-questions", INITIAL_QUESTIONS))
  const [messages, setMessages] = useState(() => readStoredJson("tourism-community-dm", []))
  const [newPost, setNewPost] = useState({ author: "", title: "", body: "", photo: "" })
  const [newQuestion, setNewQuestion] = useState("")
  const [newQuestionAnswer, setNewQuestionAnswer] = useState("")
  const [buddyFilter, setBuddyFilter] = useState("family")
  const [dmDraft, setDmDraft] = useState({ to: "", text: "" })
  const [message, setMessage] = useState("")

  const buddyGroups = useMemo(
    () => [
      { id: "buddy-1", name: "Family Kigali Weekend", style: "family", members: 8 },
      { id: "buddy-2", name: "Volcano Hikers", style: "adventure", members: 13 },
      { id: "buddy-3", name: "Culture and Museums", style: "culture", members: 6 },
      { id: "buddy-4", name: "Food and Photo Walk", style: "relaxation", members: 10 },
    ],
    [],
  )

  const filteredBuddies = useMemo(
    () => buddyGroups.filter((group) => group.style === buddyFilter),
    [buddyFilter, buddyGroups],
  )

  const persistPosts = (next) => {
    setPosts(next)
    writeStoredJson("tourism-community-posts", next)
  }

  const persistQuestions = (next) => {
    setQuestions(next)
    writeStoredJson("tourism-community-questions", next)
  }

  const handleCreatePost = (event) => {
    event.preventDefault()
    if (!newPost.author || !newPost.title || !newPost.body) {
      setMessage("Author, title, and story text are required.")
      return
    }
    const created = {
      id: `post-${Date.now()}`,
      ...newPost,
      photo:
        newPost.photo ||
        "https://images.unsplash.com/photo-1501466044931-62695aada8e9?auto=format&fit=crop&w=900&q=80",
      likes: 0,
      comments: [],
    }
    const next = [created, ...posts]
    persistPosts(next)
    setNewPost({ author: "", title: "", body: "", photo: "" })
    setMessage("Post shared with the community feed.")
  }

  const likePost = (id) => {
    const next = posts.map((post) => (post.id === id ? { ...post, likes: post.likes + 1 } : post))
    persistPosts(next)
  }

  const sharePost = (title) => {
    setMessage(`Share link copied for: ${title}`)
  }

  const addComment = (id) => {
    const comment = window.prompt("Add comment")
    if (!comment) return
    const next = posts.map((post) =>
      post.id === id ? { ...post, comments: [...post.comments, comment] } : post,
    )
    persistPosts(next)
  }

  const handleAskLocal = (event) => {
    event.preventDefault()
    if (!newQuestion || !newQuestionAnswer) {
      setMessage("Question and local answer are required.")
      return
    }
    const next = [
      { id: `q-${Date.now()}`, question: newQuestion, answer: newQuestionAnswer },
      ...questions,
    ]
    persistQuestions(next)
    setNewQuestion("")
    setNewQuestionAnswer("")
    setMessage("Question added to Ask a Local forum.")
  }

  const sendMessage = (event) => {
    event.preventDefault()
    if (!dmDraft.to || !dmDraft.text) {
      setMessage("Recipient and message text are required.")
      return
    }
    const next = appendStoredItem("tourism-community-dm", {
      to: dmDraft.to,
      text: dmDraft.text,
      at: new Date().toISOString(),
    })
    setMessages(next)
    setDmDraft({ to: "", text: "" })
    setMessage("Direct message sent.")
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">Community and Social Features</h1>
          <p className="mt-2 text-slate-200">
            User-generated stories, Ask a Local forum, buddy finder, badges, and direct messaging.
          </p>
        </header>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="space-y-6 xl:col-span-2">
            <div className="app-card">
              <h2 className="text-xl font-bold text-slate-900">Travel feed</h2>
              <div className="mt-4 grid gap-4">
                {posts.map((post) => (
                  <article key={post.id} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <img src={post.photo} alt={post.title} className="h-44 w-full object-cover" />
                    <div className="p-4">
                      <h3 className="text-sm font-bold text-slate-900">{post.title}</h3>
                      <p className="text-xs text-slate-500">By {post.author}</p>
                      <p className="mt-2 text-sm text-slate-700">{post.body}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => likePost(post.id)}
                          className="rounded bg-emerald-600 px-2 py-1 font-semibold text-white"
                        >
                          Like ({post.likes})
                        </button>
                        <button
                          type="button"
                          onClick={() => addComment(post.id)}
                          className="rounded bg-indigo-600 px-2 py-1 font-semibold text-white"
                        >
                          Comment ({post.comments.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => sharePost(post.title)}
                          className="rounded bg-amber-500 px-2 py-1 font-semibold text-white"
                        >
                          Share
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Trip story and review composer</h2>
              <form className="mt-3 grid gap-3 md:grid-cols-2" onSubmit={handleCreatePost}>
                <input
                  value={newPost.author}
                  onChange={(event) => setNewPost((current) => ({ ...current, author: event.target.value }))}
                  placeholder="Author name"
                  className="input-control"
                />
                <input
                  value={newPost.title}
                  onChange={(event) => setNewPost((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Story title"
                  className="input-control"
                />
                <input
                  value={newPost.photo}
                  onChange={(event) => setNewPost((current) => ({ ...current, photo: event.target.value }))}
                  placeholder="Photo URL (optional)"
                  className="input-control md:col-span-2"
                />
                <textarea
                  value={newPost.body}
                  onChange={(event) => setNewPost((current) => ({ ...current, body: event.target.value }))}
                  placeholder="Share your trip story or review..."
                  className="input-control h-28 md:col-span-2"
                />
                <button
                  type="submit"
                  className="btn-primary md:col-span-2"
                >
                  Publish to feed
                </button>
              </form>
            </div>
          </section>

          <section className="space-y-6">
            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Ask a Local Q&A</h2>
              <div className="mt-3 space-y-2 text-sm">
                {questions.map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{item.question}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.answer}</p>
                  </div>
                ))}
              </div>
              <form className="mt-3 space-y-2" onSubmit={handleAskLocal}>
                <input
                  value={newQuestion}
                  onChange={(event) => setNewQuestion(event.target.value)}
                  placeholder="Ask a question"
                  className="input-control"
                />
                <input
                  value={newQuestionAnswer}
                  onChange={(event) => setNewQuestionAnswer(event.target.value)}
                  placeholder="Local answer"
                  className="input-control"
                />
                <button type="submit" className="rounded bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">
                  Add Q&A
                </button>
              </form>
            </div>

            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Travel buddy / group finder</h2>
              <select
                value={buddyFilter}
                onChange={(event) => setBuddyFilter(event.target.value)}
                className="input-control mt-3"
              >
                <option value="family">Family</option>
                <option value="adventure">Adventure</option>
                <option value="culture">Culture</option>
                <option value="relaxation">Relaxation</option>
              </select>
              <div className="mt-3 space-y-2 text-sm">
                {filteredBuddies.map((group) => (
                  <div key={group.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{group.name}</p>
                    <p className="text-xs text-slate-600">Members: {group.members}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="app-card">
              <h2 className="text-lg font-bold text-slate-900">Badges and achievements</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {BADGES.map((badge) => (
                  <li key={badge.label} className="rounded border border-slate-200 bg-slate-50 p-3">
                    <p className="font-semibold text-slate-800">{badge.label}</p>
                    <p className="text-xs text-slate-600">{badge.condition}</p>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="app-card">
            <h2 className="text-lg font-bold text-slate-900">Direct messaging</h2>
            <form className="mt-3 space-y-2" onSubmit={sendMessage}>
              <input
                value={dmDraft.to}
                onChange={(event) => setDmDraft((current) => ({ ...current, to: event.target.value }))}
                placeholder="Recipient user"
                className="input-control"
              />
              <textarea
                value={dmDraft.text}
                onChange={(event) => setDmDraft((current) => ({ ...current, text: event.target.value }))}
                placeholder="Message text"
                className="input-control h-24"
              />
              <button type="submit" className="btn-primary">
                Send message
              </button>
            </form>
            <div className="mt-4 max-h-40 space-y-2 overflow-auto text-xs">
              {messages.map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">To: {entry.to}</p>
                  <p className="text-slate-600">{entry.text}</p>
                </div>
              ))}
              {!messages.length && <p className="text-slate-500">No direct messages yet.</p>}
            </div>
          </section>

          <section className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-lg">
            <h2 className="text-lg font-bold text-amber-900">Community moderation guidelines</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">
              {COMMUNITY_GUIDELINES.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        </div>

        {message && <div className="rounded-xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-700">{message}</div>}
      </div>
    </div>
  )
}

