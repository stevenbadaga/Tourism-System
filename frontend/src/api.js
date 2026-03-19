const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080/api"

async function requestJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }
  if (response.status === 204) return null
  return response.json()
}

export const api = {
  attractions: {
    list: async (city = null) => {
      const url = city ? `${API_BASE}/attractions?city=${city}` : `${API_BASE}/attractions`
      return requestJson(url)
    },
    get: async (id) => requestJson(`${API_BASE}/attractions/${id}`),
    create: async (data) =>
      requestJson(`${API_BASE}/attractions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },
  users: {
    list: async () => requestJson(`${API_BASE}/users`),
    get: async (id) => requestJson(`${API_BASE}/users/${id}`),
    create: async (data) =>
      requestJson(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
  },
  bookings: {
    list: async (userId = null) => {
      const url = userId ? `${API_BASE}/bookings?userId=${userId}` : `${API_BASE}/bookings`
      return requestJson(url)
    },
    create: async (userId, attractionId, date) =>
      requestJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, attractionId, date }),
      }),
    createService: async (payload) =>
      requestJson(`${API_BASE}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: async (bookingId, payload) =>
      requestJson(`${API_BASE}/bookings/${bookingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    cancel: async (bookingId) =>
      requestJson(`${API_BASE}/bookings/${bookingId}`, {
        method: "DELETE",
      }),
  },
  reviews: {
    list: async (attractionId = null) => {
      const url = attractionId ? `${API_BASE}/reviews?attractionId=${attractionId}` : `${API_BASE}/reviews`
      return requestJson(url)
    },
    create: async (payload) =>
      requestJson(`${API_BASE}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
  preferences: {
    list: async () => requestJson(`${API_BASE}/preferences`),
    get: async (userId) => requestJson(`${API_BASE}/preferences/${userId}`),
    save: async (payload) =>
      requestJson(`${API_BASE}/preferences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: async (userId, payload) =>
      requestJson(`${API_BASE}/preferences/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
  itineraries: {
    list: async (userId = null) => {
      const url = userId ? `${API_BASE}/itineraries?userId=${userId}` : `${API_BASE}/itineraries`
      return requestJson(url)
    },
    create: async (payload) =>
      requestJson(`${API_BASE}/itineraries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
  },
  recommendations: {
    list: async (city = null) => {
      const url = city ? `${API_BASE}/recommendations?city=${city}` : `${API_BASE}/recommendations`
      return requestJson(url)
    },
  },
  auth: {
    register: async (payload) =>
      requestJson(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    login: async (payload) =>
      requestJson(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    socialLogin: async (payload) =>
      requestJson(`${API_BASE}/auth/social-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    ssoLogin: async (payload) =>
      requestJson(`${API_BASE}/auth/sso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    verifyMfa: async (payload) =>
      requestJson(`${API_BASE}/auth/mfa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    guest: async () =>
      requestJson(`${API_BASE}/auth/guest`, {
        method: "POST",
      }),
    recover: async (email) =>
      requestJson(`${API_BASE}/auth/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      }),
    sessions: async (userId) => requestJson(`${API_BASE}/auth/sessions?userId=${userId}`),
    revokeSession: async (sessionId) =>
      requestJson(`${API_BASE}/auth/sessions/${sessionId}`, {
        method: "DELETE",
      }),
    updateMfa: async (userId, enabled) =>
      requestJson(`${API_BASE}/auth/mfa/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    deleteAccount: async (userId) =>
      requestJson(`${API_BASE}/auth/account/${userId}`, {
        method: "DELETE",
      }),
    exportData: async (userId) => requestJson(`${API_BASE}/auth/export/${userId}`),
  },
  notifications: {
    alerts: async (params = {}) => {
      const query = new URLSearchParams()
      if (params.lat != null) query.set("lat", String(params.lat))
      if (params.lng != null) query.set("lng", String(params.lng))
      if (params.types?.length) query.set("types", params.types.join(","))
      const suffix = query.toString() ? `?${query.toString()}` : ""
      return requestJson(`${API_BASE}/notifications${suffix}`)
    },
    forecast: async () => requestJson(`${API_BASE}/notifications/forecast`),
  },
}
