import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { getDestinationMetadata, normalizeLabel, toServiceFee } from "../data/tourismData"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const SERVICE_TYPES = [
  { key: "tour", label: "Tours" },
  { key: "hotel", label: "Hotels" },
  { key: "transport", label: "Transport" },
]

const PAYMENT_METHODS = [
  { key: "card", label: "Card" },
  { key: "mobile", label: "Mobile Money" },
  { key: "paypal", label: "PayPal" },
  { key: "wallet", label: "Travel Wallet" },
]

const CONFIRMATION_CHANNELS = ["email", "sms", "in-app"]

const PROMO_RULES = {
  VISITRW: { type: "percent", value: 15, label: "15% destination promo" },
  FAMILY5: { type: "fixed", value: 5, label: "$5 family discount" },
  EARLY10: { type: "percent", value: 10, label: "10% early booking" },
}

function safeList(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.value)) return payload.value
  return []
}

function toLocalIso(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function parseIso(value) {
  const [year, month, day] = String(value || "")
    .slice(0, 10)
    .split("-")
    .map((entry) => Number(entry))
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day, 0, 0, 0, 0)
}

function todayIso() {
  return toLocalIso(new Date())
}

function dateOnly(value) {
  if (!value) return ""
  return String(value).slice(0, 10)
}

function addDaysIso(baseDate, offset) {
  const parsed = parseIso(baseDate) || new Date()
  const date = new Date(parsed)
  date.setDate(date.getDate() + Number(offset || 0))
  return toLocalIso(date)
}

function diffDays(fromDate, toDate) {
  const start = parseIso(fromDate)
  const end = parseIso(toDate)
  if (!start || !end) return 0
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.floor((end.getTime() - start.getTime()) / msPerDay)
}

function seededNumber(seed) {
  const text = String(seed || "")
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 2147483647
  }
  return Math.abs(hash)
}

function randomToken(length = 8) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let value = ""
  for (let index = 0; index < length; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)]
  }
  return value
}

function randomTicketNumber() {
  return `ETK-${randomToken(8)}`
}

function randomPaymentReference() {
  return `PAY-${randomToken(6)}-${Math.floor(Math.random() * 900 + 100)}`
}

function formatDateTime(value) {
  if (!value) return "N/A"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  return parsed.toLocaleString()
}

function bookingTone(status) {
  const normalized = String(status || "").toUpperCase()
  if (normalized.includes("CANCELLED")) return "bg-rose-100 text-rose-700"
  if (normalized.includes("PENDING")) return "bg-amber-100 text-amber-700"
  return "bg-emerald-100 text-emerald-700"
}

function defaultInventory(attractions) {
  const attractionTours = attractions.slice(0, 8).map((attraction, index) => {
    const metadata = getDestinationMetadata(attraction)
    return {
      id: `tour-${attraction.id}`,
      type: "tour",
      name: attraction.name,
      provider: ["Sanderling Adventures", "Rwanda Trails", "East Horizon"][index % 3],
      city: attraction.city || "Kigali",
      basePrice: 85 + index * 14,
      availability: 7 - (index % 3),
      rating: 4.2 + (index % 4) * 0.15,
      attractionId: attraction.id,
      image: metadata.images?.[0] || "",
      tags: metadata.highlights?.slice(0, 2) || [],
    }
  })

  return [
    ...attractionTours,
    {
      id: "hotel-kigali-1",
      type: "hotel",
      name: "Kigali City Lodge",
      provider: "Sanderling Stay",
      city: "Kigali",
      basePrice: 132,
      availability: 6,
      rating: 4.6,
      image:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      tags: ["Downtown", "Breakfast included"],
    },
    {
      id: "hotel-rubavu-1",
      type: "hotel",
      name: "Lake Kivu Suites",
      provider: "Kivu Partner",
      city: "Rubavu",
      basePrice: 165,
      availability: 3,
      rating: 4.8,
      image:
        "https://images.unsplash.com/photo-1496417263034-38ec4f0b665a?auto=format&fit=crop&w=1200&q=80",
      tags: ["Lake view", "Resort"],
    },
    {
      id: "hotel-musanze-1",
      type: "hotel",
      name: "Volcano View Residence",
      provider: "Peak Retreat",
      city: "Musanze",
      basePrice: 148,
      availability: 4,
      rating: 4.5,
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      tags: ["Mountain access", "Quiet zone"],
    },
    {
      id: "transport-bus-1",
      type: "transport",
      name: "Intercity Shuttle",
      provider: "TransitLink",
      city: "Kigali",
      basePrice: 26,
      availability: 20,
      rating: 4.1,
      image:
        "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80",
      tags: ["Shared ride", "Daily schedule"],
    },
    {
      id: "transport-car-1",
      type: "transport",
      name: "Private Driver Service",
      provider: "SafeMove",
      city: "Musanze",
      basePrice: 72,
      availability: 8,
      rating: 4.4,
      image:
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
      tags: ["Door-to-door", "Air-conditioned"],
    },
    {
      id: "transport-kivu-1",
      type: "transport",
      name: "Lake Transfer Van",
      provider: "Kivu Mobility",
      city: "Rubavu",
      basePrice: 44,
      availability: 11,
      rating: 4.2,
      image:
        "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
      tags: ["Group seats", "Luggage support"],
    },
  ]
}

function normalizeBookingFromApi(item) {
  const selectedDate = dateOnly(item.selectedDate || item.date || item.createdAt || todayIso())
  return {
    id: item.id ?? `local-${Date.now()}-${randomToken(4)}`,
    userId: String(item.userId || item.user?.id || ""),
    ticketNumber: item.ticketNumber || randomTicketNumber(),
    name: item.name || item.serviceName || item.attraction?.name || "Service",
    selectedDate: selectedDate || todayIso(),
    provider: item.provider || "Sanderling",
    amountPaid: Number(item.amountPaid ?? item.amountUsd ?? 0),
    type: item.type || item.serviceType || "tour",
    status: String(item.status || "CONFIRMED").toUpperCase(),
    confirmationChannel: item.confirmationChannel || "email",
    createdAt: item.createdAt || new Date().toISOString(),
    paymentMethod: item.paymentMethod || "",
    paymentReference: item.paymentReference || "",
    attractionId: item.attractionId || item.attraction?.id || null,
  }
}

function matchesService(booking, service) {
  if (!booking || !service) return false
  const bookingName = String(booking.name || booking.serviceName || "").toLowerCase()
  const serviceName = String(service.name || "").toLowerCase()
  if (booking.attractionId && service.attractionId) {
    return String(booking.attractionId) === String(service.attractionId)
  }
  return bookingName === serviceName
}

function computeLiveAvailability(service, selectedDate, bookings) {
  const activeBookings = bookings.filter((booking) => {
    const status = String(booking.status || "").toUpperCase()
    if (status === "CANCELLED") return false
    return dateOnly(booking.selectedDate || booking.date) === selectedDate && matchesService(booking, service)
  })

  const dateSignal = (seededNumber(`${service.id}-${selectedDate}`) % 5) - 2
  return Math.max(0, Number(service.availability || 0) + dateSignal - activeBookings.length)
}
function toDynamicPricing(service, selectedDate, travelerCount, liveAvailability) {
  const baseService = toServiceFee(service.basePrice, service.type)
  const day = (parseIso(selectedDate) || new Date()).getDay()
  const isWeekend = day === 5 || day === 6
  const weekendFactor = isWeekend ? 1.12 : 1

  const leadDays = diffDays(todayIso(), selectedDate)
  const leadFactor = leadDays <= 2 ? 1.1 : leadDays >= 21 ? 0.92 : 1

  const demandFactor = liveAvailability <= 2 ? 1.18 : liveAvailability <= 5 ? 1.08 : liveAvailability >= 15 ? 0.95 : 1

  let travelerFactor = 1
  if (service.type === "transport") travelerFactor = 1 + Math.max(0, travelerCount - 1) * 0.1
  if (service.type === "tour") travelerFactor = 1 + Math.max(0, travelerCount - 1) * 0.07
  if (service.type === "hotel") travelerFactor = 1 + Math.max(0, travelerCount - 2) * 0.05

  const dynamicPrice = Math.max(8, Math.round(baseService * weekendFactor * leadFactor * demandFactor * travelerFactor))
  const marketAverage = Math.round(baseService * 1.08)
  const savings = Math.max(0, marketAverage - dynamicPrice)

  return {
    baseService,
    dynamicPrice,
    marketAverage,
    savings,
    pricingNotes: [
      isWeekend ? "Weekend demand uplift" : "Standard day pricing",
      leadDays <= 2 ? "Late-booking adjustment" : leadDays >= 21 ? "Early-booking discount" : "Normal lead-time",
      liveAvailability <= 3 ? "Low availability factor" : "Availability stable",
    ],
  }
}

function compareDateAsc(a, b) {
  return String(a.selectedDate || "").localeCompare(String(b.selectedDate || ""))
}

function compareDateDesc(a, b) {
  return String(b.selectedDate || "").localeCompare(String(a.selectedDate || ""))
}

function toRefundPercent(daysUntilTrip) {
  if (daysUntilTrip >= 7) return 0.9
  if (daysUntilTrip >= 2) return 0.5
  return 0
}

function normalizeChannelLabel(channel) {
  const value = String(channel || "").toLowerCase()
  if (value === "sms") return "SMS"
  if (value === "email") return "Email"
  if (value === "in-app") return "In-app"
  return "In-app"
}

function buildTicketText(booking) {
  return [
    "SANDERLING E-TICKET",
    "-------------------",
    `Ticket Number: ${booking.ticketNumber}`,
    `Service: ${booking.name}`,
    `Type: ${normalizeLabel(booking.type)}`,
    `Date: ${booking.selectedDate}`,
    `Provider: ${booking.provider}`,
    `Amount Paid (USD): ${booking.amountPaid}`,
    `Status: ${booking.status}`,
    `Confirmation Channel: ${booking.confirmationChannel}`,
    `Payment Method: ${booking.paymentMethod || "N/A"}`,
    `Payment Reference: ${booking.paymentReference || "N/A"}`,
    `Issued At: ${formatDateTime(booking.createdAt)}`,
    "",
    `QR Payload: ${booking.ticketNumber}|${booking.selectedDate}|${booking.amountPaid}`,
  ].join("\n")
}

function downloadTicketFile(booking) {
  if (typeof window === "undefined") return
  const text = buildTicketText(booking)
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${booking.ticketNumber || "ticket"}.txt`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function BookingCenter() {
  const storedDate = readStoredJson("tourism-booking-date-v3", todayIso())
  const validStoredDate = parseIso(storedDate) ? storedDate : todayIso()

  const [attractions, setAttractions] = useState([])
  const [users, setUsers] = useState([])
  const [inventory, setInventory] = useState([])
  const [globalBookings, setGlobalBookings] = useState(() =>
    readStoredJson("tourism-booking-global-cache-v1", []).map(normalizeBookingFromApi),
  )
  const [bookingRecords, setBookingRecords] = useState(() =>
    readStoredJson(
      "tourism-booking-records-v3",
      readStoredJson("tourism-booking-records-v2", []).map(normalizeBookingFromApi),
    ).map(normalizeBookingFromApi),
  )

  const [selectedType, setSelectedType] = useState(() => readStoredJson("tourism-booking-type-v3", "tour"))
  const [selectedCity, setSelectedCity] = useState(() => readStoredJson("tourism-booking-city-v3", ""))
  const [selectedDate, setSelectedDate] = useState(validStoredDate)
  const [travelerCount, setTravelerCount] = useState(() => readStoredJson("tourism-booking-travelers-v3", 1))
  const [searchText, setSearchText] = useState("")
  const [selectedUserId, setSelectedUserId] = useState("")
  const [focusServiceId, setFocusServiceId] = useState("")

  const [cart, setCart] = useState(() => readStoredJson("tourism-booking-cart-v3", []))
  const [promoCode, setPromoCode] = useState("")
  const [paymentMethod, setPaymentMethod] = useState("card")
  const [paymentMeta, setPaymentMeta] = useState({
    cardNumber: "",
    cardHolder: "",
    mobileNumber: "",
    paypalEmail: "",
    walletId: "",
  })
  const [checkoutChannel, setCheckoutChannel] = useState(() =>
    readStoredJson("tourism-booking-channel-v3", "email"),
  )
  const [alertSubscriptions, setAlertSubscriptions] = useState(() =>
    readStoredJson("tourism-booking-alert-subscriptions-v1", {
      booking: true,
      weather: true,
      safety: false,
    }),
  )
  const [notificationLog, setNotificationLog] = useState(() =>
    readStoredJson("tourism-booking-notification-log-v1", []),
  )
  const [reminderLedger, setReminderLedger] = useState(() =>
    readStoredJson("tourism-booking-reminder-ledger-v1", {}),
  )
  const [ticketBatch, setTicketBatch] = useState([])
  const [bookingDateDrafts, setBookingDateDrafts] = useState({})
  const [lastAvailabilityRefresh, setLastAvailabilityRefresh] = useState(() =>
    readStoredJson("tourism-booking-last-refresh-v1", "Never"),
  )

  const [loading, setLoading] = useState(true)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => writeStoredJson("tourism-booking-type-v3", selectedType), [selectedType])
  useEffect(() => writeStoredJson("tourism-booking-city-v3", selectedCity), [selectedCity])
  useEffect(() => writeStoredJson("tourism-booking-date-v3", selectedDate), [selectedDate])
  useEffect(() => writeStoredJson("tourism-booking-travelers-v3", travelerCount), [travelerCount])
  useEffect(() => writeStoredJson("tourism-booking-channel-v3", checkoutChannel), [checkoutChannel])
  useEffect(() => writeStoredJson("tourism-booking-cart-v3", cart), [cart])
  useEffect(() => writeStoredJson("tourism-booking-records-v3", bookingRecords), [bookingRecords])
  useEffect(() => writeStoredJson("tourism-booking-global-cache-v1", globalBookings), [globalBookings])
  useEffect(() => writeStoredJson("tourism-booking-alert-subscriptions-v1", alertSubscriptions), [alertSubscriptions])
  useEffect(() => writeStoredJson("tourism-booking-notification-log-v1", notificationLog), [notificationLog])
  useEffect(() => writeStoredJson("tourism-booking-reminder-ledger-v1", reminderLedger), [reminderLedger])
  useEffect(() => writeStoredJson("tourism-booking-last-refresh-v1", lastAvailabilityRefresh), [lastAvailabilityRefresh])

  useEffect(() => {
    let cancelled = false
    Promise.allSettled([api.attractions.list(), api.users.list(), api.bookings.list()]).then(
      ([attractionResult, usersResult, bookingsResult]) => {
        if (cancelled) return
        const attractionList =
          attractionResult.status === "fulfilled"
            ? safeList(attractionResult.value)
            : []
        const usersList = usersResult.status === "fulfilled" ? safeList(usersResult.value) : []
        const normalizedBookings =
          bookingsResult.status === "fulfilled"
            ? safeList(bookingsResult.value).map(normalizeBookingFromApi)
            : []

        setAttractions(attractionList)
        setInventory(defaultInventory(attractionList))
        setUsers(usersList)
        setGlobalBookings((current) => (normalizedBookings.length ? normalizedBookings : current))
        if (usersList.length) setSelectedUserId((current) => current || String(usersList[0].id))
        setLoading(false)
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!selectedUserId) return
    let cancelled = false
    api.bookings
      .list(Number(selectedUserId))
      .then((records) => {
        if (cancelled) return
        const normalized = safeList(records).map(normalizeBookingFromApi)
        setBookingRecords((current) => {
          const currentByTicket = new Map(
            current
              .filter((entry) => entry.ticketNumber)
              .map((entry) => [entry.ticketNumber, entry]),
          )
          const merged = normalized.map((entry) => {
            const existing = currentByTicket.get(entry.ticketNumber)
            if (!existing) return entry
            return {
              ...entry,
              paymentMethod: existing.paymentMethod || entry.paymentMethod,
              paymentReference: existing.paymentReference || entry.paymentReference,
            }
          })

          const localOnlyForUser = current.filter(
            (entry) =>
              String(entry.id).startsWith("local-") &&
              String(entry.userId || selectedUserId) === String(selectedUserId),
          )
          return [...localOnlyForUser, ...merged]
        })
      })
      .catch(() => {
        // Keep the local version if the API is down.
      })

    return () => {
      cancelled = true
    }
  }, [selectedUserId])

  useEffect(() => {
    const interval = setInterval(() => {
      setInventory((current) =>
        current.map((service) => {
          const drift = (seededNumber(`${service.id}-${Date.now()}`) % 3) - 1
          return {
            ...service,
            availability: Math.max(0, Number(service.availability || 0) + drift),
          }
        }),
      )
      setLastAvailabilityRefresh(new Date().toLocaleString())
    }, 40000)

    return () => clearInterval(interval)
  }, [])

  const cities = useMemo(
    () => Array.from(new Set(inventory.map((service) => service.city).filter(Boolean))),
    [inventory],
  )

  const visibleInventory = useMemo(() => {
    const keyword = searchText.trim().toLowerCase()
    return inventory.filter((service) => {
      if (service.type !== selectedType) return false
      if (selectedCity && service.city !== selectedCity) return false
      if (
        keyword &&
        !`${service.name} ${service.provider} ${service.city}`
          .toLowerCase()
          .includes(keyword)
      ) {
        return false
      }
      return true
    })
  }, [inventory, searchText, selectedCity, selectedType])

  const pricedInventory = useMemo(
    () =>
      visibleInventory.map((service) => {
        const liveAvailability = computeLiveAvailability(service, selectedDate, globalBookings)
        const pricing = toDynamicPricing(service, selectedDate, travelerCount, liveAvailability)
        return { ...service, liveAvailability, ...pricing }
      }),
    [globalBookings, selectedDate, travelerCount, visibleInventory],
  )

  useEffect(() => {
    if (!pricedInventory.length) {
      setFocusServiceId("")
      return
    }
    const exists = pricedInventory.some((service) => service.id === focusServiceId)
    if (!focusServiceId || !exists) {
      setFocusServiceId(pricedInventory[0].id)
    }
  }, [focusServiceId, pricedInventory])

  const focusedService =
    pricedInventory.find((service) => service.id === focusServiceId) || pricedInventory[0] || null

  const availabilityWindow = useMemo(() => {
    if (!focusedService) return []
    return Array.from({ length: 7 }, (_, offset) => {
      const date = addDaysIso(selectedDate, offset)
      const liveAvailability = computeLiveAvailability(focusedService, date, globalBookings)
      const pricing = toDynamicPricing(focusedService, date, travelerCount, liveAvailability)
      return {
        date,
        liveAvailability,
        dynamicPrice: pricing.dynamicPrice,
      }
    })
  }, [focusedService, globalBookings, selectedDate, travelerCount])

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.dynamicPrice || 0), 0),
    [cart],
  )

  const activePromo = useMemo(() => PROMO_RULES[promoCode.trim().toUpperCase()] || null, [promoCode])

  const discountAmount = useMemo(() => {
    if (!activePromo) return 0
    if (activePromo.type === "percent") return Math.round(cartSubtotal * (activePromo.value / 100))
    return Math.min(cartSubtotal, Number(activePromo.value || 0))
  }, [activePromo, cartSubtotal])

  const netAmount = Math.max(0, cartSubtotal - discountAmount)
  const paymentFee = useMemo(() => {
    if (!cart.length) return 0
    if (paymentMethod === "card") return Math.round(netAmount * 0.025)
    if (paymentMethod === "mobile") return Math.round(netAmount * 0.01)
    if (paymentMethod === "paypal") return Math.round(netAmount * 0.02)
    return 0
  }, [cart.length, netAmount, paymentMethod])
  const grandTotal = Math.max(0, netAmount + paymentFee)

  const today = todayIso()
  const upcomingBookings = useMemo(
    () =>
      bookingRecords
        .filter(
          (booking) =>
            String(booking.status).toUpperCase() !== "CANCELLED" && booking.selectedDate >= today,
        )
        .sort(compareDateAsc),
    [bookingRecords, today],
  )

  const historyBookings = useMemo(
    () =>
      bookingRecords
        .filter(
          (booking) =>
            String(booking.status).toUpperCase() !== "CANCELLED" && booking.selectedDate < today,
        )
        .sort(compareDateDesc),
    [bookingRecords, today],
  )

  const cancelledBookings = useMemo(
    () =>
      bookingRecords
        .filter((booking) => String(booking.status).toUpperCase() === "CANCELLED")
        .sort(compareDateDesc),
    [bookingRecords],
  )

  useEffect(() => {
    if (!alertSubscriptions.booking || !upcomingBookings.length) return
    const nowIso = new Date().toISOString()
    const dueSoon = upcomingBookings.filter((booking) => {
      const daysUntilTrip = diffDays(todayIso(), booking.selectedDate)
      if (daysUntilTrip < 0 || daysUntilTrip > 2) return false
      const ledgerKey = `${booking.ticketNumber}-${booking.selectedDate}`
      return !reminderLedger[ledgerKey]
    })

    if (!dueSoon.length) return

    const reminderEntries = dueSoon.map((booking) => {
      const daysUntilTrip = diffDays(todayIso(), booking.selectedDate)
      const channel = normalizeChannelLabel(booking.confirmationChannel || checkoutChannel)
      return {
        id: `${booking.ticketNumber}-${booking.selectedDate}-reminder`,
        createdAt: nowIso,
        title: `${channel} reminder: ${booking.name}`,
        details: `Scheduled for ${booking.selectedDate}. Trip starts in ${daysUntilTrip} day(s). Ticket ${booking.ticketNumber}.`,
      }
    })

    setNotificationLog((current) => {
      const existingIds = new Set(current.map((entry) => entry.id))
      const fresh = reminderEntries.filter((entry) => !existingIds.has(entry.id))
      if (!fresh.length) return current
      return [...fresh, ...current].slice(0, 50)
    })

    setReminderLedger((current) => {
      const next = { ...current }
      dueSoon.forEach((booking) => {
        const ledgerKey = `${booking.ticketNumber}-${booking.selectedDate}`
        next[ledgerKey] = nowIso
      })
      return next
    })
  }, [alertSubscriptions.booking, checkoutChannel, reminderLedger, upcomingBookings])

  const refreshAvailability = async () => {
    setCheckingAvailability(true)
    setError("")
    try {
      const records = await api.bookings.list()
      const normalized = safeList(records).map(normalizeBookingFromApi)
      setGlobalBookings((current) => (normalized.length ? normalized : current))
    } catch (requestError) {
      // Fall back to the saved cache if the API is down.
    } finally {
      setInventory((current) =>
        current.map((service) => {
          const drift = (Math.random() > 0.5 ? 1 : -1) * (Math.random() > 0.65 ? 1 : 0)
          return {
            ...service,
            availability: Math.max(0, Number(service.availability || 0) + drift),
          }
        }),
      )
      setLastAvailabilityRefresh(new Date().toLocaleString())
      setCheckingAvailability(false)
      setMessage("Availability and pricing signals refreshed.")
    }
  }

  const addToCart = (service) => {
    setError("")
    setMessage("")
    if (!selectedUserId) {
      setError("Select a traveler profile first.")
      return
    }
    if (!parseIso(selectedDate)) {
      setError("Choose a valid travel date.")
      return
    }
    if (selectedDate < todayIso()) {
      setError("Bookings cannot be created for past dates.")
      return
    }
    if (service.liveAvailability <= 0) {
      setError("Selected service is currently unavailable for this date.")
      return
    }

    const cartKey = `${service.id}-${selectedDate}`
    setCart((current) => {
      const existing = current.find((item) => item.cartKey === cartKey)
      if (existing) {
        return current.map((item) =>
          item.cartKey === cartKey
            ? {
                ...item,
                travelerCount,
                selectedDate,
                dynamicPrice: service.dynamicPrice,
                liveAvailability: service.liveAvailability,
              }
            : item,
        )
      }
      return [
        ...current,
        {
          cartKey,
          serviceId: service.id,
          attractionId: service.attractionId || null,
          type: service.type,
          name: service.name,
          provider: service.provider,
          city: service.city,
          selectedDate,
          travelerCount,
          baseService: service.baseService,
          dynamicPrice: service.dynamicPrice,
          liveAvailability: service.liveAvailability,
          pricingNotes: service.pricingNotes || [],
        },
      ]
    })
    setInventory((current) =>
      current.map((item) =>
        item.id === service.id ? { ...item, availability: Math.max(0, item.availability - 1) } : item,
      ),
    )
    setMessage(`${service.name} added to booking cart.`)
  }

  const removeFromCart = (cartKey) => {
    setCart((current) => {
      const item = current.find((entry) => entry.cartKey === cartKey)
      if (item) {
        setInventory((inventoryCurrent) =>
          inventoryCurrent.map((service) =>
            service.id === item.serviceId ? { ...service, availability: service.availability + 1 } : service,
          ),
        )
      }
      return current.filter((entry) => entry.cartKey !== cartKey)
    })
  }

  const validatePayment = () => {
    if (paymentMethod === "card") {
      const cleanCard = String(paymentMeta.cardNumber || "").replace(/\s+/g, "")
      if (!paymentMeta.cardHolder.trim() || cleanCard.length < 12) {
        return "Card holder and card number are required."
      }
    }
    if (paymentMethod === "mobile") {
      if (String(paymentMeta.mobileNumber || "").replace(/[^\d+]/g, "").length < 10) {
        return "Valid mobile money number is required."
      }
    }
    if (paymentMethod === "paypal") {
      if (!String(paymentMeta.paypalEmail || "").includes("@")) {
        return "Valid PayPal email is required."
      }
    }
    if (paymentMethod === "wallet") {
      if (!String(paymentMeta.walletId || "").trim()) {
        return "Travel wallet ID is required."
      }
    }
    return ""
  }

  const checkout = async () => {
    setError("")
    setMessage("")
    if (!selectedUserId) {
      setError("Select traveler profile before checkout.")
      return
    }
    if (!cart.length) {
      setError("Add at least one service to cart.")
      return
    }

    const paymentError = validatePayment()
    if (paymentError) {
      setError(paymentError)
      return
    }

    setProcessingCheckout(true)
    const paymentReference = randomPaymentReference()

    try {
      const requests = cart.map((item) => {
        const ticketNumber = randomTicketNumber()
        const payload = {
          userId: Number(selectedUserId),
          attractionId: item.attractionId ? Number(item.attractionId) : null,
          date: item.selectedDate,
          serviceType: item.type,
          serviceName: item.name,
          provider: item.provider,
          status: "CONFIRMED",
          amountUsd: Number(item.dynamicPrice),
          confirmationChannel: checkoutChannel,
          ticketNumber,
        }
        return api.bookings
          .createService(payload)
          .then((response) => ({ status: "fulfilled", response, payload, item, ticketNumber }))
          .catch((requestError) => ({ status: "rejected", requestError, payload, item, ticketNumber }))
      })

      const settled = await Promise.all(requests)
      const createdRecords = settled.map((entry) => {
        if (entry.status === "fulfilled") {
          const apiRecord = entry.response?.value || entry.response || {}
          return {
            ...normalizeBookingFromApi(apiRecord),
            id: apiRecord.id ?? entry.payload.ticketNumber,
            userId: String(selectedUserId),
            name: entry.item.name,
            type: entry.item.type,
            selectedDate: entry.item.selectedDate,
            provider: entry.item.provider,
            amountPaid: Number(entry.item.dynamicPrice),
            status: "CONFIRMED",
            confirmationChannel: checkoutChannel,
            paymentMethod,
            paymentReference,
            ticketNumber: apiRecord.ticketNumber || entry.ticketNumber,
          }
        }

        return {
          id: `local-${Date.now()}-${entry.item.cartKey}`,
          userId: String(selectedUserId),
          ticketNumber: entry.ticketNumber,
          name: entry.item.name,
          selectedDate: entry.item.selectedDate,
          provider: entry.item.provider,
          amountPaid: Number(entry.item.dynamicPrice),
          type: entry.item.type,
          status: "CONFIRMED",
          confirmationChannel: checkoutChannel,
          createdAt: new Date().toISOString(),
          paymentMethod,
          paymentReference,
          attractionId: entry.item.attractionId || null,
        }
      })

      setBookingRecords((current) => [...createdRecords, ...current])
      setGlobalBookings((current) => [...createdRecords, ...current])
      setTicketBatch(createdRecords.slice(0, 4))
      setCart([])
      setPromoCode("")
      setNotificationLog((current) =>
        [
          ...createdRecords.map((booking) => ({
            id: `${booking.ticketNumber}-notice`,
            createdAt: new Date().toISOString(),
            title: `Booking confirmed: ${booking.name}`,
            details: `${booking.selectedDate} via ${booking.confirmationChannel}. Ticket ${booking.ticketNumber}.`,
          })),
          ...current,
        ].slice(0, 50),
      )
      setMessage(`Checkout complete. ${createdRecords.length} e-ticket(s) generated.`)
    } catch (requestError) {
      setError("Checkout failed. Please try again.")
    } finally {
      setProcessingCheckout(false)
    }
  }

  const updateBookingDate = async (booking) => {
    const nextDate = bookingDateDrafts[booking.ticketNumber] || booking.selectedDate
    setError("")
    setMessage("")
    if (!parseIso(nextDate)) {
      setError("Select a valid date before updating.")
      return
    }
    if (nextDate < todayIso()) {
      setError("Updated date cannot be in the past.")
      return
    }
    if (String(booking.status).toUpperCase() === "CANCELLED") {
      setError("Cancelled bookings cannot be modified.")
      return
    }

    const persisted = !String(booking.id).startsWith("local-") && !Number.isNaN(Number(booking.id))
    if (persisted) {
      try {
        await api.bookings.update(Number(booking.id), {
          date: nextDate,
          confirmationChannel: booking.confirmationChannel || checkoutChannel,
        })
      } catch (requestError) {
        setError("Could not update booking date.")
        return
      }
    }

    setBookingRecords((current) =>
      current.map((entry) =>
        entry.ticketNumber === booking.ticketNumber ? { ...entry, selectedDate: nextDate } : entry,
      ),
    )
    setGlobalBookings((current) =>
      current.map((entry) =>
        entry.ticketNumber === booking.ticketNumber ? { ...entry, selectedDate: nextDate } : entry,
      ),
    )
    setMessage(`Booking updated to ${nextDate}.`)
  }

  const cancelBooking = async (booking) => {
    setError("")
    setMessage("")
    const persisted = !String(booking.id).startsWith("local-") && !Number.isNaN(Number(booking.id))
    if (persisted) {
      try {
        await api.bookings.cancel(Number(booking.id))
      } catch (requestError) {
        setError("Could not cancel this booking.")
        return
      }
    }

    const daysUntilTrip = diffDays(todayIso(), booking.selectedDate)
    const refundPercent = toRefundPercent(daysUntilTrip)
    const refundAmount = Math.round(Number(booking.amountPaid || 0) * refundPercent)

    setBookingRecords((current) =>
      current.map((entry) =>
        entry.ticketNumber === booking.ticketNumber ? { ...entry, status: "CANCELLED" } : entry,
      ),
    )
    setGlobalBookings((current) =>
      current.map((entry) =>
        entry.ticketNumber === booking.ticketNumber ? { ...entry, status: "CANCELLED" } : entry,
      ),
    )
    setMessage(
      `Booking cancelled. Estimated refund: $${refundAmount} (${Math.round(refundPercent * 100)}% policy).`,
    )
  }

  const toggleAlertSubscription = (key) => {
    setAlertSubscriptions((current) => ({ ...current, [key]: !current[key] }))
  }

  const sendReminderNow = (booking) => {
    const nowIso = new Date().toISOString()
    const channel = normalizeChannelLabel(booking.confirmationChannel || checkoutChannel)
    const entry = {
      id: `${booking.ticketNumber}-${Date.now()}-manual-reminder`,
      createdAt: nowIso,
      title: `${channel} reminder sent: ${booking.name}`,
      details: `Reminder sent for ${booking.selectedDate}. Ticket ${booking.ticketNumber}.`,
    }
    setNotificationLog((current) => [entry, ...current].slice(0, 50))
    setMessage(`Reminder sent via ${channel}.`)
  }

  if (loading) {
    return (
      <div className="page-stage">
        <div className="shell-container">
          <div className="app-card text-sm text-slate-600">Loading booking workspace...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-6 pb-8">
        <header className="hero-banner">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100">Booking Module</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Reservation and Checkout Control Center</h1>
          <p className="mt-3 max-w-3xl text-sm text-cyan-50 md:text-base">
            Real-time availability, dynamic pricing, secure payment simulation, instant e-ticketing, and full booking lifecycle management.
          </p>
          <div className="mt-5 grid gap-2 text-sm sm:grid-cols-4">
            <div className="stat-chip">
              <p className="text-lg font-bold">{pricedInventory.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Visible Services</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{cart.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">In Cart</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{upcomingBookings.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Upcoming</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{lastAvailabilityRefresh === "Never" ? "No" : "Yes"}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Live Sync</p>
            </div>
          </div>
        </header>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <section className="space-y-5">
            <section className="app-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="section-title text-lg">Service Discovery and Availability</h2>
                  <p className="section-note">Filter services, monitor live inventory, and add bookings to cart.</p>
                </div>
                <button
                  type="button"
                  onClick={refreshAvailability}
                  disabled={checkingAvailability}
                  className="btn-secondary"
                >
                  {checkingAvailability ? "Refreshing..." : "Refresh Availability"}
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <select
                  className="input-control"
                  value={selectedUserId}
                  onChange={(event) => setSelectedUserId(event.target.value)}
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
                  value={selectedType}
                  onChange={(event) => setSelectedType(event.target.value)}
                >
                  {SERVICE_TYPES.map((service) => (
                    <option key={service.key} value={service.key}>
                      {service.label}
                    </option>
                  ))}
                </select>

                <select
                  className="input-control"
                  value={selectedCity}
                  onChange={(event) => setSelectedCity(event.target.value)}
                >
                  <option value="">All cities</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </select>

                <input
                  type="date"
                  className="input-control"
                  min={todayIso()}
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                />
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <input
                  className="input-control"
                  placeholder="Search by service, provider, or city"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                />
                <input
                  type="number"
                  min={1}
                  max={12}
                  className="input-control"
                  value={travelerCount}
                  onChange={(event) => setTravelerCount(Math.max(1, Math.min(12, Number(event.target.value) || 1)))}
                />
              </div>

              <p className="mt-3 text-xs text-slate-500">Last refresh: {lastAvailabilityRefresh}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {pricedInventory.map((service) => (
                  <article key={service.id} className="app-card-soft space-y-2">
                    {service.image && (
                      <img
                        src={service.image}
                        alt={`${service.name} cover`}
                        className="h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-800">{service.name}</h3>
                        <p className="text-xs text-slate-500">
                          {service.city} | {service.provider}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                          service.liveAvailability <= 2
                            ? "bg-rose-100 text-rose-700"
                            : service.liveAvailability <= 5
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {service.liveAvailability} left
                      </span>
                    </div>

                    <div className="rounded-lg bg-white p-2 text-xs text-slate-600">
                      <p className="font-semibold text-slate-700">
                        ${service.dynamicPrice} USD{" "}
                        <span className="font-normal text-slate-400">(base ${service.baseService})</span>
                      </p>
                      <p>Market avg: ${service.marketAverage} | Savings: ${service.savings}</p>
                      <p className="mt-1">{service.pricingNotes.join(" | ")}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setFocusServiceId(service.id)} className="btn-secondary flex-1">
                        View Week
                      </button>
                      <button type="button" onClick={() => addToCart(service)} className="btn-primary flex-1">
                        Add to Cart
                      </button>
                    </div>

                    {!!service.tags?.length && (
                      <div className="flex flex-wrap gap-1">
                        {service.tags.map((tag) => (
                          <span
                            key={`${service.id}-${tag}`}
                            className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {!pricedInventory.length && (
                  <p className="section-note md:col-span-2">No services available for the current filter.</p>
                )}
              </div>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Availability Window and Date Pricing</h2>
              <p className="section-note">
                {focusedService
                  ? `${focusedService.name} weekly snapshot for quick date comparison.`
                  : "Select a service to preview 7-day availability."}
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
                {availabilityWindow.map((slot) => (
                  <button
                    type="button"
                    key={`${slot.date}-${focusServiceId}`}
                    onClick={() => setSelectedDate(slot.date)}
                    className={`app-card-soft text-left ${
                      slot.date === selectedDate ? "border-cyan-300 bg-cyan-50" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold text-slate-700">{slot.date}</p>
                    <p className="text-xs text-slate-500">{slot.liveAvailability} seats/units</p>
                    <p className="mt-1 text-xs font-semibold text-cyan-700">${slot.dynamicPrice}</p>
                  </button>
                ))}
                {!availabilityWindow.length && <p className="section-note md:col-span-4 xl:col-span-7">No service selected.</p>}
              </div>
            </section>
          </section>

          <aside className="space-y-5">
            <section className="app-card">
              <h2 className="section-title text-lg">Cart and Promo</h2>
              <div className="mt-3 max-h-52 space-y-2 overflow-auto">
                {cart.map((item) => (
                  <article key={item.cartKey} className="app-card-soft">
                    <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.selectedDate} | {normalizeLabel(item.type)} | {item.city}
                    </p>
                    <p className="text-xs text-slate-500">Travelers: {item.travelerCount}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-cyan-700">${item.dynamicPrice}</p>
                      <button type="button" className="text-xs font-semibold text-rose-600" onClick={() => removeFromCart(item.cartKey)}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
                {!cart.length && <p className="section-note">No services in cart yet.</p>}
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  className="input-control"
                  placeholder="Promo code (VISITRW, FAMILY5, EARLY10)"
                  value={promoCode}
                  onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                />
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span>${cartSubtotal}</span>
                </p>
                <p className="mt-1 flex items-center justify-between">
                  <span>Promo discount {activePromo ? `(${activePromo.label})` : ""}</span>
                  <span>-${discountAmount}</span>
                </p>
                <p className="mt-1 flex items-center justify-between">
                  <span>Payment fee</span>
                  <span>${paymentFee}</span>
                </p>
                <p className="mt-2 flex items-center justify-between text-base font-bold text-slate-800">
                  <span>Total due</span>
                  <span>${grandTotal}</span>
                </p>
              </div>

              {!!cart.length && (
                <button type="button" onClick={() => setCart([])} className="btn-secondary mt-3 w-full">
                  Clear Cart
                </button>
              )}
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Secure Checkout and Payment</h2>
              <p className="section-note">Simulated gateway with instant confirmation and e-ticket issuance.</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    type="button"
                    key={method.key}
                    onClick={() => setPaymentMethod(method.key)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                      paymentMethod === method.key
                        ? "bg-cyan-700 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 space-y-2">
                {paymentMethod === "card" && (
                  <>
                    <input
                      className="input-control"
                      placeholder="Cardholder name"
                      value={paymentMeta.cardHolder}
                      onChange={(event) =>
                        setPaymentMeta((current) => ({ ...current, cardHolder: event.target.value }))
                      }
                    />
                    <input
                      className="input-control"
                      placeholder="Card number"
                      value={paymentMeta.cardNumber}
                      onChange={(event) =>
                        setPaymentMeta((current) => ({ ...current, cardNumber: event.target.value }))
                      }
                    />
                  </>
                )}

                {paymentMethod === "mobile" && (
                  <input
                    className="input-control"
                    placeholder="Mobile money number"
                    value={paymentMeta.mobileNumber}
                    onChange={(event) =>
                      setPaymentMeta((current) => ({ ...current, mobileNumber: event.target.value }))
                    }
                  />
                )}

                {paymentMethod === "paypal" && (
                  <input
                    className="input-control"
                    placeholder="PayPal email"
                    value={paymentMeta.paypalEmail}
                    onChange={(event) =>
                      setPaymentMeta((current) => ({ ...current, paypalEmail: event.target.value }))
                    }
                  />
                )}

                {paymentMethod === "wallet" && (
                  <input
                    className="input-control"
                    placeholder="Travel wallet ID"
                    value={paymentMeta.walletId}
                    onChange={(event) =>
                      setPaymentMeta((current) => ({ ...current, walletId: event.target.value }))
                    }
                  />
                )}

                <select
                  className="input-control"
                  value={checkoutChannel}
                  onChange={(event) => setCheckoutChannel(event.target.value)}
                >
                  {CONFIRMATION_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      Confirmation via {channel}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                <p className="font-semibold text-slate-700">Security profile</p>
                <p>Encrypted payment form (simulated), masked processing reference, and auditable booking log.</p>
              </div>

              <button
                type="button"
                onClick={checkout}
                disabled={processingCheckout}
                className="btn-primary mt-3 w-full"
              >
                {processingCheckout ? "Processing checkout..." : `Confirm and Pay $${grandTotal}`}
              </button>
            </section>

            <section className="app-card">
              <h2 className="section-title text-lg">Latest E-Tickets</h2>
              <div className="mt-3 space-y-2">
                {ticketBatch.map((ticket) => (
                  <article key={ticket.ticketNumber} className="app-card-soft">
                    <p className="text-sm font-semibold text-slate-700">{ticket.name}</p>
                    <p className="text-xs text-slate-500">
                      {ticket.ticketNumber} | {ticket.selectedDate}
                    </p>
                    <button
                      type="button"
                      onClick={() => downloadTicketFile(ticket)}
                      className="btn-secondary mt-2 w-full"
                    >
                      Download E-Ticket
                    </button>
                  </article>
                ))}
                {!ticketBatch.length && <p className="section-note">Complete checkout to generate e-tickets.</p>}
              </div>
            </section>
          </aside>
        </div>

        <section className="app-card">
          <h2 className="section-title text-lg">Booking History and Reservation Management</h2>
          <p className="section-note">Modify date, cancel reservations, and download booking records by lifecycle state.</p>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            <section className="app-card-soft">
              <h3 className="text-sm font-semibold text-slate-800">Upcoming</h3>
              <div className="mt-3 space-y-2">
                {upcomingBookings.map((booking) => (
                  <article key={`${booking.ticketNumber}-upcoming`} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{booking.name}</p>
                        <p className="text-xs text-slate-500">
                          {booking.selectedDate} | {booking.provider}
                        </p>
                        <p className="text-xs text-slate-500">
                          Ticket: {booking.ticketNumber} | Paid: ${booking.amountPaid}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${bookingTone(booking.status)}`}>
                        {booking.status}
                      </span>
                    </div>

                    <div className="mt-2 flex gap-2">
                      <input
                        type="date"
                        min={todayIso()}
                        className="input-control"
                        value={bookingDateDrafts[booking.ticketNumber] || booking.selectedDate}
                        onChange={(event) =>
                          setBookingDateDrafts((current) => ({
                            ...current,
                            [booking.ticketNumber]: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => updateBookingDate(booking)} className="btn-secondary flex-1">
                        Update Date
                      </button>
                      <button type="button" onClick={() => cancelBooking(booking)} className="btn-primary flex-1">
                        Cancel
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => sendReminderNow(booking)}
                      className="btn-secondary mt-2 w-full"
                    >
                      Send Reminder ({normalizeChannelLabel(booking.confirmationChannel)})
                    </button>

                    <button type="button" onClick={() => downloadTicketFile(booking)} className="btn-secondary mt-2 w-full">
                      Download Ticket
                    </button>
                  </article>
                ))}
                {!upcomingBookings.length && <p className="section-note">No upcoming bookings.</p>}
              </div>
            </section>

            <section className="app-card-soft">
              <h3 className="text-sm font-semibold text-slate-800">Past Reservations</h3>
              <div className="mt-3 space-y-2">
                {historyBookings.map((booking) => (
                  <article key={`${booking.ticketNumber}-history`} className="rounded-lg border border-slate-200 bg-white p-3">
                    <p className="text-sm font-semibold text-slate-700">{booking.name}</p>
                    <p className="text-xs text-slate-500">
                      {booking.selectedDate} | {booking.provider}
                    </p>
                    <p className="text-xs text-slate-500">
                      {booking.ticketNumber} | {booking.paymentReference || "No payment ref"}
                    </p>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${bookingTone(booking.status)}`}>
                        {booking.status}
                      </span>
                      <button type="button" onClick={() => downloadTicketFile(booking)} className="text-xs font-semibold text-cyan-700">
                        Download
                      </button>
                    </div>
                  </article>
                ))}
                {!historyBookings.length && <p className="section-note">No historical records.</p>}
              </div>
            </section>

            <section className="app-card-soft">
              <h3 className="text-sm font-semibold text-slate-800">Cancelled</h3>
              <div className="mt-3 space-y-2">
                {cancelledBookings.map((booking) => {
                  const daysUntilTrip = diffDays(todayIso(), booking.selectedDate)
                  const refundPercent = Math.round(toRefundPercent(daysUntilTrip) * 100)
                  return (
                    <article key={`${booking.ticketNumber}-cancelled`} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-sm font-semibold text-rose-800">{booking.name}</p>
                      <p className="text-xs text-rose-700">
                        {booking.selectedDate} | Ticket {booking.ticketNumber}
                      </p>
                      <p className="mt-1 text-xs text-rose-700">Policy estimate at cancellation window: {refundPercent}% refund.</p>
                    </article>
                  )
                })}
                {!cancelledBookings.length && <p className="section-note">No cancelled bookings.</p>}
              </div>
            </section>
          </div>
        </section>

        <section className="app-card">
          <h2 className="section-title text-lg">Alert Preferences and Policy</h2>
          <div className="mt-3 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <section className="app-card-soft">
              <p className="text-sm font-semibold text-slate-800">Cancellation and refund policy</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>7+ days before service date: 90% refund</li>
                <li>2-6 days before service date: 50% refund</li>
                <li>0-1 day before service date: non-refundable</li>
                <li>Confirmed bookings include generated e-ticket and payment reference</li>
              </ul>
            </section>

            <section className="app-card-soft">
              <p className="text-sm font-semibold text-slate-800">Subscription toggles</p>
              <div className="mt-2 space-y-2 text-xs">
                {Object.keys(alertSubscriptions).map((key) => (
                  <label key={key} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <span className="font-semibold text-slate-700">{normalizeLabel(key)} alerts</span>
                    <input
                      type="checkbox"
                      checked={!!alertSubscriptions[key]}
                      onChange={() => toggleAlertSubscription(key)}
                    />
                  </label>
                ))}
              </div>
            </section>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Notification history log</p>
            <div className="mt-2 max-h-48 space-y-2 overflow-auto">
              {notificationLog.map((entry) => (
                <article key={entry.id} className="app-card-soft">
                  <p className="text-sm font-semibold text-slate-700">{entry.title}</p>
                  <p className="text-xs text-slate-500">{entry.details}</p>
                  <p className="text-xs text-slate-400">{formatDateTime(entry.createdAt)}</p>
                </article>
              ))}
              {!notificationLog.length && (
                <p className="section-note">Checkout confirmations and reminders will populate this log.</p>
              )}
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
