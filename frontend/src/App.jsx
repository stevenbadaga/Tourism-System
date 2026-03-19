import React, { useState } from "react"
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom"
import Home from "./pages/Home"
import AttractionList from "./pages/AttractionList"
import AttractionDetail from "./pages/AttractionDetail"
import Recommendations from "./pages/Recommendations"
import Dashboard from "./pages/Dashboard"
import UserProfile from "./pages/UserProfile"
import Reviews from "./pages/Reviews"
import ItineraryBuilder from "./pages/ItineraryBuilder"
import Map from "./pages/Map"
import Notifications from "./pages/Notifications"
import BookingCenter from "./pages/BookingCenter"
import Analytics from "./pages/Analytics"
import Auth from "./pages/Auth"
import Community from "./pages/Community"

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/attractions", label: "Destinations" },
  { to: "/recommendations", label: "Recommendations" },
  { to: "/map", label: "Map" },
  { to: "/itineraries", label: "Planner" },
  { to: "/bookings", label: "Bookings" },
  { to: "/notifications", label: "Alerts" },
  { to: "/community", label: "Community" },
  { to: "/profile", label: "Profile" },
  { to: "/auth", label: "Access" },
  { to: "/analytics", label: "Analytics" },
]

function Navigation() {
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 shadow-sm backdrop-blur-md">
      <div className="shell-container flex h-16 items-center justify-between">
        <Link to="/" className="group flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-700 text-sm font-bold text-white">
            ST
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Sanderling Rwanda</p>
            <p className="text-sm font-bold text-slate-900 group-hover:text-cyan-700">Intelligent Tourist System</p>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          className="btn-secondary md:hidden"
        >
          Menu
        </button>

        <div
          className={`${
            menuOpen ? "block" : "hidden"
          } absolute left-0 right-0 top-16 border-b border-slate-200 bg-white p-4 shadow md:static md:block md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
        >
          <div className="grid gap-2 md:flex md:flex-wrap md:items-center md:justify-end md:gap-2">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                label={item.label}
                active={location.pathname === item.to}
                onClick={() => setMenuOpen(false)}
              />
            ))}
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavLink({ to, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-[0.02em] transition md:text-sm ${
        active
          ? "bg-cyan-700 text-white shadow"
          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  )
}

export default function App() {
  return (
    <Router>
      <Navigation />
      <main className="min-h-screen">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/attractions" element={<AttractionList />} />
          <Route path="/attractions/:id" element={<AttractionDetail />} />
          <Route path="/attractions/:id/reviews" element={<Reviews />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<UserProfile />} />
          <Route path="/itineraries" element={<ItineraryBuilder />} />
          <Route path="/map" element={<Map />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/bookings" element={<BookingCenter />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/community" element={<Community />} />
        </Routes>
      </main>
      <Footer />
    </Router>
  )
}

function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="shell-container grid gap-4 py-8 md:grid-cols-2 md:items-center">
        <div>
          <p className="text-sm font-semibold text-slate-900">2026 Intelligent Tourist System</p>
          <p className="text-xs text-slate-500">Built for Sanderling Travel and Tours, Rwanda</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          <span className="chip">Personalized Guidance</span>
          <span className="chip">Live Updates</span>
          <span className="chip">Smart Planning</span>
        </div>
      </div>
    </footer>
  )
}