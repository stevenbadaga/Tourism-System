import React from "react"
import { Link } from "react-router-dom"

export default function Dashboard() {
  return (
    <div className="page-stage">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-slate-900">Access Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          The authentication and role-based access module has moved to the dedicated Access page.
        </p>
        <Link
          to="/auth"
          className="btn-primary mt-5"
        >
          Open Access module
        </Link>
      </div>
    </div>
  )
}
