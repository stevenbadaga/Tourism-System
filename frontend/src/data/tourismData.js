export const CATEGORY_OPTIONS = [
  "national-parks",
  "museums",
  "markets",
  "restaurants",
  "culture",
  "adventure",
]

export const PREFERENCE_OPTIONS = [
  "adventure",
  "culture",
  "relaxation",
  "family",
  "luxury",
]

export const INTEREST_OPTIONS = [
  "hiking",
  "history",
  "wildlife",
  "food",
  "photography",
]

export const ACCESSIBILITY_OPTIONS = ["mobility", "dietary", "language"]

export const CITY_COORDINATES = {
  Kigali: { lat: -1.9441, lng: 30.0619 },
  Musanze: { lat: -1.4996, lng: 29.6344 },
  Rubavu: { lat: -1.6876, lng: 29.2577 },
  Huye: { lat: -2.5967, lng: 29.7394 },
  Nyagatare: { lat: -1.2978, lng: 30.3256 },
  Rusizi: { lat: -2.4846, lng: 28.8967 },
}

const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1528130295022-55f13f4d73b4?auto=format&fit=crop&w=1200&q=80",
  "https://images.unsplash.com/photo-1518544866330-4e6f69d6e50f?auto=format&fit=crop&w=1200&q=80",
]

const DESTINATION_METADATA_BY_NAME = {
  "Kigali Genocide Memorial": {
    category: "museums",
    hours: "08:00 - 17:00",
    entryFeeUsd: 15,
    bestTime: "Morning guided sessions",
    highlights: ["Memorial exhibitions", "Guided learning tour", "Reflection gardens"],
    etiquetteTips: [
      "Keep voices low in remembrance areas.",
      "Ask staff before taking photos in exhibition halls.",
      "Allow extra time for reflection and guided context.",
    ],
    coordinates: { lat: -1.9208, lng: 30.0603 },
    images: [
      "https://images.unsplash.com/photo-1578922794704-7bdd46f70f42?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1526749837599-b4eba9fd855e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1467269204594-9661b134dd2b?auto=format&fit=crop&w=1200&q=80",
    ],
    virtualTourUrl: "https://www.google.com/maps/search/?api=1&query=Kigali+Genocide+Memorial",
  },
  "Nyungwe Forest Canopy Walk": {
    category: "national-parks",
    hours: "08:00 - 16:00",
    entryFeeUsd: 60,
    bestTime: "Dry-season mornings",
    highlights: ["Canopy bridge", "Rainforest biodiversity", "Birdwatching trails"],
    etiquetteTips: [
      "Wear proper hiking shoes and follow ranger instructions.",
      "Keep to marked forest trails and avoid littering.",
      "Respect wildlife distance guidelines at all times.",
    ],
    coordinates: { lat: -2.462, lng: 29.2088 },
    images: [
      "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1425913397330-cf8af2ff40a1?auto=format&fit=crop&w=1200&q=80",
    ],
    virtualTourUrl: "https://www.google.com/maps/search/?api=1&query=Nyungwe+Forest+Canopy+Walk",
  },
  "Lake Kivu Boardwalk": {
    category: "adventure",
    hours: "06:00 - 20:00",
    entryFeeUsd: 5,
    bestTime: "Sunset and early evening",
    highlights: ["Lakeside promenade", "Cycling route", "Boat departure points"],
    etiquetteTips: [
      "Use marked cycling and walking lanes.",
      "Confirm boat timings before late-evening rides.",
      "Support local vendors in designated market spaces.",
    ],
    coordinates: { lat: -1.6879, lng: 29.2635 },
    images: [
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
    ],
    virtualTourUrl: "https://www.google.com/maps/search/?api=1&query=Lake+Kivu+Boardwalk",
  },
  "King's Palace Museum": {
    category: "culture",
    hours: "08:00 - 18:00",
    entryFeeUsd: 10,
    bestTime: "Mid-morning tours",
    highlights: ["Traditional royal residence", "Inyambo cattle heritage", "Cultural exhibits"],
    etiquetteTips: [
      "Follow museum guide instructions during cultural demonstrations.",
      "Avoid feeding or touching heritage cattle without permission.",
      "Respect boundaries around preserved structures.",
    ],
    coordinates: { lat: -2.3517, lng: 29.7422 },
    images: [
      "https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=1200&q=80",
    ],
    virtualTourUrl: "https://www.google.com/maps/search/?api=1&query=Kings+Palace+Museum+Rwanda",
  },
  "Volcanoes National Park Gate": {
    category: "national-parks",
    hours: "07:00 - 17:00",
    entryFeeUsd: 80,
    bestTime: "Early morning departures",
    highlights: ["Gorilla trek staging point", "Volcanic trail access", "Ranger briefings"],
    etiquetteTips: [
      "Arrive early for permit checks and ranger assignment.",
      "Carry rain protection and maintain pace with your guide.",
      "Do not leave marked trekking groups in the park.",
    ],
    coordinates: { lat: -1.4318, lng: 29.5801 },
    images: [
      "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1472396961693-142e6e269027?auto=format&fit=crop&w=1200&q=80",
      "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80",
    ],
    virtualTourUrl: "https://www.google.com/maps/search/?api=1&query=Volcanoes+National+Park+Rwanda",
  },
}

const GENERIC_CULTURAL_TIPS = [
  "Greetings matter: start with a polite hello before requests.",
  "Carry cash for smaller markets and local vendors.",
  "Weekends are busier; book major attractions in advance.",
]

const GENERIC_HIGHLIGHTS = ["Signature viewpoint", "Local food options", "Family-friendly access"]

export function normalizeLabel(value) {
  if (!value) return ""
  return String(value)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function deriveCategory(attraction) {
  const known = DESTINATION_METADATA_BY_NAME[attraction?.name]
  if (known?.category) return known.category
  const text = `${attraction?.name || ""} ${attraction?.description || ""}`.toLowerCase()
  if (text.includes("museum") || text.includes("gallery")) return "museums"
  if (text.includes("park") || text.includes("wild") || text.includes("volcano")) return "national-parks"
  if (text.includes("market")) return "markets"
  if (text.includes("food") || text.includes("restaurant") || text.includes("cafe")) return "restaurants"
  if (text.includes("castle") || text.includes("heritage") || text.includes("history")) return "culture"
  return "adventure"
}

export function getDestinationMetadata(attraction) {
  const name = attraction?.name || ""
  const city = attraction?.city || "Kigali"
  const cityCoords = CITY_COORDINATES[city] || CITY_COORDINATES.Kigali
  const byName = DESTINATION_METADATA_BY_NAME[name] || {}

  return {
    category: byName.category || deriveCategory(attraction),
    hours: byName.hours || "08:00 - 18:00",
    entryFeeUsd: byName.entryFeeUsd ?? 9,
    bestTime: byName.bestTime || "Morning",
    highlights: byName.highlights || GENERIC_HIGHLIGHTS,
    etiquetteTips: byName.etiquetteTips || GENERIC_CULTURAL_TIPS,
    images: byName.images || DEFAULT_IMAGES,
    virtualTourUrl: byName.virtualTourUrl || "https://www.google.com/maps",
    coordinates: byName.coordinates || cityCoords,
  }
}

export function estimateTravelMinutes(fromCoords, toCoords, mode = "drive") {
  if (!fromCoords || !toCoords) return 0

  const toRad = (v) => (v * Math.PI) / 180
  const earthRadiusKm = 6371
  const dLat = toRad(toCoords.lat - fromCoords.lat)
  const dLng = toRad(toCoords.lng - fromCoords.lng)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(fromCoords.lat)) * Math.cos(toRad(toCoords.lat)) * Math.sin(dLng / 2) ** 2
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const speeds = {
    walk: 4.5,
    drive: 35,
    public: 22,
  }
  const speedKmPerHour = speeds[mode] || speeds.drive
  return Math.max(5, Math.round((distanceKm / speedKmPerHour) * 60))
}

export function toServiceFee(amount, type) {
  const serviceMultipliers = {
    tour: 1,
    transport: 0.8,
    hotel: 1.5,
  }
  const multiplier = serviceMultipliers[type] || 1
  return Math.round(amount * multiplier)
}

export function safeAverage(values) {
  if (!values?.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
