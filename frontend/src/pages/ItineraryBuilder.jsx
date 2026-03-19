import React, { useEffect, useMemo, useState } from "react"
import { api } from "../api"
import { estimateTravelMinutes, getDestinationMetadata, normalizeLabel } from "../data/tourismData"
import { readStoredJson, writeStoredJson } from "../utils/storage"

const MIN_ACTIVITY_MINUTES = 30

function compareSchedule(a, b) {
  if (Number(a.dayIndex || 0) !== Number(b.dayIndex || 0)) {
    return Number(a.dayIndex || 0) - Number(b.dayIndex || 0)
  }
  return String(a.start).localeCompare(String(b.start))
}

function toMinutes(value) {
  if (!value || !String(value).includes(":")) return 0
  const [hours, minutes] = String(value).split(":").map((entry) => Number(entry))
  return Math.max(0, Math.min(1439, hours * 60 + minutes))
}

function toTime(value) {
  const safe = Math.max(0, Math.min(1439, Number(value) || 0))
  const hours = Math.floor(safe / 60)
  const minutes = safe % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

function addMinutes(time, delta) {
  return toTime(toMinutes(time) + Number(delta || 0))
}

function durationMinutes(start, end) {
  return Math.max(MIN_ACTIVITY_MINUTES, toMinutes(end) - toMinutes(start))
}

function hasConflict(a, b) {
  return String(a.start) < String(b.end) && String(b.start) < String(a.end)
}

function toIcsDate(date, time) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
}

function addDays(baseDate, dayOffset) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + Number(dayOffset || 0))
  return date.toISOString().slice(0, 10)
}

function formatDateLabel(baseDate, dayOffset) {
  const date = new Date(baseDate)
  date.setDate(date.getDate() + Number(dayOffset || 0))
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}

function normalizeActivity(item) {
  if (!item) return null
  return {
    id: item.id || `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    attractionId: String(item.attractionId || ""),
    dayIndex: Math.max(0, Number(item.dayIndex || 0)),
    start: item.start || "09:00",
    end: item.end || "11:00",
    cost: Number(item.cost || 0),
    mode: item.mode || "drive",
    participantScope: item.participantScope || "all",
    customParticipants: item.customParticipants || "",
    note: item.note || "",
  }
}

function participantLabel(activity, travelerCount) {
  if (activity.participantScope === "owner") return "Trip owner"
  if (activity.participantScope === "custom") {
    return activity.customParticipants || "Custom participants"
  }
  return `All ${Math.max(1, travelerCount)} travelers`
}

function safeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function parseCollaborators(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean)
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function parseActivities(value) {
  if (!value) return []
  if (Array.isArray(value)) return value.map(normalizeActivity).filter(Boolean)
  try {
    const parsed = JSON.parse(String(value))
    return Array.isArray(parsed) ? parsed.map(normalizeActivity).filter(Boolean) : []
  } catch {
    return []
  }
}

function normalizeItineraryRecord(record) {
  return {
    ...record,
    tripDate: record.tripDate || new Date().toISOString().slice(0, 10),
    tripLength: Math.max(1, Number(record.tripLength || 1)),
    visibility: record.visibility || "private",
    collaborators: parseCollaborators(record.collaborators),
    activities: parseActivities(record.activitiesJson),
  }
}

export default function ItineraryBuilder() {
  const storedActivities = readStoredJson(
    "tourism-itinerary-activities-v2",
    readStoredJson("tourism-itinerary-activities", []),
  )

  const [users, setUsers] = useState([])
  const [userId, setUserId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [tripDate, setTripDate] = useState(new Date().toISOString().slice(0, 10))
  const [tripLength, setTripLength] = useState(() => readStoredJson("tourism-itinerary-trip-length-v2", 3))
  const [visibility, setVisibility] = useState("private")
  const [collaborators, setCollaborators] = useState(() => readStoredJson("tourism-itinerary-collaborators-v2", []))
  const [collaboratorInput, setCollaboratorInput] = useState("")
  const [itineraries, setItineraries] = useState([])
  const [attractions, setAttractions] = useState([])
  const [activities, setActivities] = useState(() => storedActivities.map(normalizeActivity).filter(Boolean))
  const [draggedActivityId, setDraggedActivityId] = useState("")
  const [activityDraft, setActivityDraft] = useState({
    attractionId: "",
    dayIndex: 0,
    start: "09:00",
    end: "11:00",
    cost: 30,
    mode: "drive",
    participantScope: "all",
    customParticipants: "",
    note: "",
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    Promise.allSettled([api.attractions.list(), api.itineraries.list(), api.users.list()]).then(
      ([attractionResult, itineraryResult, usersResult]) => {
        const attractionList =
          attractionResult.status === "fulfilled"
            ? attractionResult.value.value || attractionResult.value || []
            : []
        const itineraryList =
          itineraryResult.status === "fulfilled"
            ? itineraryResult.value.value || itineraryResult.value || []
            : []
        const usersList =
          usersResult.status === "fulfilled" ? usersResult.value.value || usersResult.value || [] : []

        setAttractions(attractionList)
        setItineraries(itineraryList.map(normalizeItineraryRecord))
        setUsers(usersList)
        if (!userId && usersList.length) setUserId(String(usersList[0].id))
      },
    )
  }, [userId])

  useEffect(() => {
    writeStoredJson("tourism-itinerary-activities-v2", activities)
    writeStoredJson("tourism-itinerary-activities", activities)
  }, [activities])

  useEffect(() => {
    writeStoredJson("tourism-itinerary-trip-length-v2", tripLength)
  }, [tripLength])

  useEffect(() => {
    writeStoredJson("tourism-itinerary-collaborators-v2", collaborators)
  }, [collaborators])

  const attractionLookup = useMemo(() => {
    const map = new Map()
    attractions.forEach((attraction) => {
      map.set(String(attraction.id), {
        ...attraction,
        metadata: getDestinationMetadata(attraction),
      })
    })
    return map
  }, [attractions])

  const enrichedActivities = useMemo(() => {
    return activities
      .map((item) => {
        const attraction = attractionLookup.get(String(item.attractionId))
        return {
          ...item,
          attraction,
          metadata: attraction?.metadata || null,
        }
      })
      .sort(compareSchedule)
  }, [activities, attractionLookup])

  const activitiesByDay = useMemo(() => {
    return Array.from({ length: Math.max(1, Number(tripLength) || 1) }, (_, dayIndex) =>
      enrichedActivities.filter((activity) => Number(activity.dayIndex || 0) === dayIndex).sort(compareSchedule),
    )
  }, [enrichedActivities, tripLength])

  const groupTravelerCount = Math.max(1, collaborators.length + 1)

  const scheduleDiagnostics = useMemo(() => {
    const conflicts = []
    const advisories = []

    activitiesByDay.forEach((dayActivities, dayIndex) => {
      for (let i = 0; i < dayActivities.length - 1; i += 1) {
        const current = dayActivities[i]
        const next = dayActivities[i + 1]

        if (hasConflict(current, next)) {
          conflicts.push(
            `Day ${dayIndex + 1}: ${current.attraction?.name || "Activity"} overlaps with ${
              next.attraction?.name || "Activity"
            }.`,
          )
          continue
        }

        const travelMinutes = estimateTravelMinutes(
          current.metadata?.coordinates,
          next.metadata?.coordinates,
          current.mode,
        )
        const gapMinutes = toMinutes(next.start) - toMinutes(current.end)

        if (gapMinutes < travelMinutes) {
          advisories.push(
            `Day ${dayIndex + 1}: ${current.attraction?.name || "Activity"} to ${
              next.attraction?.name || "Activity"
            } needs about ${travelMinutes} min travel, but only ${Math.max(0, gapMinutes)} min is scheduled.`,
          )
        }
      }
    })

    return { conflicts, advisories }
  }, [activitiesByDay])

  const travelEstimates = useMemo(() => {
    const lines = []
    activitiesByDay.forEach((dayActivities, dayIndex) => {
      for (let i = 0; i < dayActivities.length - 1; i += 1) {
        const current = dayActivities[i]
        const next = dayActivities[i + 1]
        const travelMinutes = estimateTravelMinutes(
          current.metadata?.coordinates,
          next.metadata?.coordinates,
          current.mode,
        )
        lines.push({
          day: dayIndex + 1,
          from: current.attraction?.name || "Activity",
          to: next.attraction?.name || "Activity",
          mode: current.mode,
          travelMinutes,
        })
      }
    })
    return lines
  }, [activitiesByDay])

  const estimatedBudget = useMemo(
    () => enrichedActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0),
    [enrichedActivities],
  )

  const budgetByDay = useMemo(() => {
    return activitiesByDay.map((dayActivities) =>
      dayActivities.reduce((sum, activity) => sum + Number(activity.cost || 0), 0),
    )
  }, [activitiesByDay])

  const publicShareLink = useMemo(() => {
    if (visibility !== "public" || !title.trim()) return ""
    return `https://sanderling.rw/itinerary/${safeId(title)}`
  }, [title, visibility])

  const addCollaborator = () => {
    const value = collaboratorInput.trim()
    setError("")
    if (!value) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid collaborator email.")
      return
    }
    if (collaborators.includes(value)) return
    setCollaborators((current) => [...current, value])
    setCollaboratorInput("")
  }

  const removeCollaborator = (email) => {
    setCollaborators((current) => current.filter((entry) => entry !== email))
  }

  const validateDraft = () => {
    if (!activityDraft.attractionId) return "Select an attraction before adding to schedule."
    if (activityDraft.start >= activityDraft.end) return "Start time must be before end time."

    const candidate = normalizeActivity({
      id: "candidate",
      ...activityDraft,
    })
    const candidateDay = Number(candidate.dayIndex || 0)
    const dayActivities = enrichedActivities
      .filter((activity) => Number(activity.dayIndex || 0) === candidateDay)
      .sort(compareSchedule)

    for (const activity of dayActivities) {
      if (hasConflict(activity, candidate)) {
        return `Conflict: ${activity.attraction?.name || "Another activity"} overlaps this time block.`
      }
    }

    return ""
  }

  const addActivity = () => {
    setError("")
    setMessage("")
    const validationError = validateDraft()
    if (validationError) {
      setError(validationError)
      return
    }

    const normalized = normalizeActivity({
      id: `activity-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ...activityDraft,
      cost: Number(activityDraft.cost || 0),
    })

    setActivities((current) => [...current, normalized])
    setMessage("Activity block added.")
  }

  const removeActivity = (id) => {
    setActivities((current) => current.filter((activity) => activity.id !== id))
  }

  const shiftActivityTime = (id, deltaMinutes) => {
    setActivities((current) =>
      current.map((activity) => {
        if (activity.id !== id) return activity
        const duration = durationMinutes(activity.start, activity.end)
        const start = addMinutes(activity.start, deltaMinutes)
        const end = addMinutes(start, duration)
        return { ...activity, start, end }
      }),
    )
  }

  const moveActivityToDay = (id, nextDayIndex) => {
    setActivities((current) => {
      const targetDay = Math.max(0, Math.min(Number(tripLength) - 1, Number(nextDayIndex) || 0))
      const moving = current.find((activity) => activity.id === id)
      if (!moving) return current

      const sameDayActivities = current
        .filter((activity) => activity.id !== id && Number(activity.dayIndex || 0) === targetDay)
        .sort(compareSchedule)
      const startBase = sameDayActivities.length
        ? sameDayActivities[sameDayActivities.length - 1].end
        : "09:00"
      const duration = durationMinutes(moving.start, moving.end)

      return current.map((activity) => {
        if (activity.id !== id) return activity
        return {
          ...activity,
          dayIndex: targetDay,
          start: startBase,
          end: addMinutes(startBase, duration),
        }
      })
    })
  }

  const optimizeRoute = () => {
    setActivities((current) => {
      const optimized = []
      const days = Math.max(1, Number(tripLength) || 1)

      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        const dayActivities = current
          .filter((activity) => Number(activity.dayIndex || 0) === dayIndex)
          .sort((a, b) => {
            const attractionA = attractionLookup.get(String(a.attractionId))
            const attractionB = attractionLookup.get(String(b.attractionId))
            const cityA = attractionA?.city || ""
            const cityB = attractionB?.city || ""
            if (cityA !== cityB) return cityA.localeCompare(cityB)
            return String(a.start).localeCompare(String(b.start))
          })

        let previous = null
        dayActivities.forEach((activity) => {
          const duration = durationMinutes(activity.start, activity.end)
          let nextStart = activity.start

          if (previous) {
            const travelMinutes = estimateTravelMinutes(
              previous.metadata?.coordinates,
              attractionLookup.get(String(activity.attractionId))?.metadata?.coordinates,
              previous.mode,
            )
            const earliestStart = addMinutes(previous.end, travelMinutes)
            if (toMinutes(nextStart) < toMinutes(earliestStart)) {
              nextStart = earliestStart
            }
          }

          const nextActivity = {
            ...activity,
            dayIndex,
            start: nextStart,
            end: addMinutes(nextStart, duration),
          }
          optimized.push(nextActivity)
          previous = {
            ...nextActivity,
            metadata: attractionLookup.get(String(nextActivity.attractionId))?.metadata,
          }
        })
      }

      return optimized.sort(compareSchedule)
    })
    setMessage("Route optimized with city grouping and travel-time-aware scheduling.")
    setError("")
  }

  const saveItinerary = async (event) => {
    event.preventDefault()
    setError("")
    setMessage("")

    if (!userId || !title.trim()) {
      setError("User and itinerary title are required.")
      return
    }

    if (scheduleDiagnostics.conflicts.length) {
      setError("Resolve schedule conflicts before saving.")
      return
    }

    const payload = {
      user: { id: Number(userId) },
      title: title.trim(),
      description: description.trim(),
      visibility,
      collaborators: collaborators.join(","),
      tripDate,
      tripLength: Math.max(1, Number(tripLength) || 1),
      activitiesJson: JSON.stringify(activities.map((activity) => ({
        ...activity,
        attractionId: String(activity.attractionId || ""),
      }))),
      createdAt: new Date().toISOString(),
    }

    try {
      setSaving(true)
      const created = await api.itineraries.create(payload)
      const normalized = normalizeItineraryRecord(created)
      setItineraries((current) => [normalized, ...current.filter((item) => item.id !== normalized.id)])
      setMessage("Itinerary saved and synced to backend.")
    } catch (requestError) {
      setError("Could not save itinerary to backend.")
    } finally {
      setSaving(false)
    }
  }

  const loadSavedItinerary = (itinerary) => {
    const normalized = normalizeItineraryRecord(itinerary)
    setUserId(
      normalized.user?.id != null
        ? String(normalized.user.id)
        : normalized.userId != null
          ? String(normalized.userId)
          : userId,
    )
    setTitle(normalized.title || "")
    setDescription(normalized.description || "")
    setTripDate(normalized.tripDate || new Date().toISOString().slice(0, 10))
    setTripLength(Math.max(1, Number(normalized.tripLength || 1)))
    setVisibility(normalized.visibility || "private")
    setCollaborators(normalized.collaborators || [])
    setActivities((normalized.activities || []).map(normalizeActivity).filter(Boolean))
    setMessage(`Loaded saved itinerary: ${normalized.title || "Untitled itinerary"}.`)
    setError("")
  }

  const exportJson = () => {
    const payload = {
      userId,
      title,
      description,
      tripDate,
      tripLength,
      visibility,
      collaborators,
      activities: enrichedActivities,
      estimatedBudget,
      generatedAt: new Date().toISOString(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `itinerary-${safeId(title || "plan")}-${tripDate}.json`
    link.click()
    URL.revokeObjectURL(url)
    setMessage("Itinerary JSON downloaded.")
    setError("")
  }

  const exportCalendar = () => {
    const bodyLines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//IntelligentTourist//EN",
      ...enrichedActivities.map((activity) => {
        const attractionName = activity.attraction?.name || "Activity"
        const eventDate = addDays(tripDate, activity.dayIndex)
        const participantInfo = participantLabel(activity, groupTravelerCount)
        return [
          "BEGIN:VEVENT",
          `UID:${activity.id}@intelligent-tourist`,
          `SUMMARY:${escapeIcsText(attractionName)}`,
          `DESCRIPTION:${escapeIcsText(`${participantInfo} | Mode: ${normalizeLabel(activity.mode)} | Budget: $${activity.cost}`)}`,
          `DTSTART:${toIcsDate(eventDate, activity.start)}`,
          `DTEND:${toIcsDate(eventDate, activity.end)}`,
          "END:VEVENT",
        ].join("\n")
      }),
      "END:VCALENDAR",
    ]

    const blob = new Blob([bodyLines.join("\n")], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `itinerary-${safeId(title || "plan")}-${tripDate}.ics`
    link.click()
    URL.revokeObjectURL(url)
    setMessage("Calendar file exported for Google or Outlook.")
    setError("")
  }

  const printableView = () => {
    window.print()
  }

  const copyShareSummary = async () => {
    const summary = [
      `Trip: ${title || "Untitled itinerary"}`,
      `Date: ${tripDate} (${tripLength} day(s))`,
      `Visibility: ${visibility}`,
      `Collaborators: ${collaborators.join(", ") || "None"}`,
      publicShareLink ? `Public link: ${publicShareLink}` : "",
    ]
      .filter(Boolean)
      .join("\n")

    try {
      await navigator.clipboard.writeText(summary)
      setMessage("Itinerary sharing summary copied.")
      setError("")
    } catch (requestError) {
      setError("Clipboard permission blocked. Copy manually from the share panel.")
    }
  }

  const dragStart = (activityId) => setDraggedActivityId(activityId)
  const dragEnd = () => setDraggedActivityId("")

  const dropOnDay = (dayIndex) => {
    if (!draggedActivityId) return
    moveActivityToDay(draggedActivityId, dayIndex)
    setDraggedActivityId("")
    setMessage(`Activity moved to Day ${dayIndex + 1}.`)
    setError("")
  }

  return (
    <div className="page-stage">
      <div className="shell-container space-y-8">
        <header className="hero-banner">
          <h1 className="text-3xl font-bold">Tour Planning and Itinerary Builder</h1>
          <p className="mt-2 text-slate-200">
            Drag-and-drop planner calendar, intelligent schedule checks, route optimization, sharing, and exports.
          </p>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-4">
            <div className="stat-chip">
              <p className="text-lg font-bold">{enrichedActivities.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Activities</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">${estimatedBudget}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Total Budget</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{groupTravelerCount}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Travelers</p>
            </div>
            <div className="stat-chip">
              <p className="text-lg font-bold">{scheduleDiagnostics.conflicts.length}</p>
              <p className="text-[11px] uppercase tracking-[0.12em]">Conflicts</p>
            </div>
          </div>
        </header>

        <div className="grid gap-8 xl:grid-cols-3">
          <section className="app-card xl:col-span-2">
            <h2 className="section-title text-lg">Itinerary Planning Setup</h2>
            <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={saveItinerary}>
              <select value={userId} onChange={(event) => setUserId(event.target.value)} className="input-control">
                {!users.length && <option value="">No users available</option>}
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
              <input
                value={tripDate}
                type="date"
                onChange={(event) => setTripDate(event.target.value)}
                className="input-control"
              />
              <select
                value={tripLength}
                onChange={(event) => setTripLength(Math.max(1, Math.min(7, Number(event.target.value) || 1)))}
                className="input-control"
              >
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <option key={days} value={days}>
                    {days} day{days > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
              <select value={visibility} onChange={(event) => setVisibility(event.target.value)} className="input-control">
                <option value="private">Private itinerary</option>
                <option value="public">Public itinerary</option>
              </select>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Trip title"
                className="input-control md:col-span-2"
              />
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Trip summary"
                className="input-control h-24 md:col-span-2"
              />
              <div className="flex gap-2 md:col-span-2">
                <input
                  value={collaboratorInput}
                  onChange={(event) => setCollaboratorInput(event.target.value)}
                  className="input-control flex-1"
                  placeholder="Collaborator email"
                />
                <button type="button" onClick={addCollaborator} className="btn-secondary">
                  Add collaborator
                </button>
              </div>
              <div className="md:col-span-2 flex flex-wrap gap-2">
                {collaborators.map((email) => (
                  <button
                    key={email}
                    type="button"
                    onClick={() => removeCollaborator(email)}
                    className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
                  >
                    {email} x
                  </button>
                ))}
                {!collaborators.length && <p className="text-xs text-slate-500">Add collaborators for group coordination.</p>}
              </div>
              <button type="submit" className="btn-primary md:col-span-2" disabled={saving}>
                {saving ? "Saving itinerary..." : "Save itinerary"}
              </button>
            </form>
          </section>

          <section className="app-card">
            <h2 className="section-title text-lg">Budget and Sharing Tools</h2>
            <p className="mt-2 text-sm text-slate-600">Estimated total activity budget: ${estimatedBudget}</p>
            <div className="mt-2 space-y-1 text-xs text-slate-500">
              {budgetByDay.map((dayBudget, index) => (
                <p key={`budget-day-${index}`}>Day {index + 1}: ${dayBudget}</p>
              ))}
            </div>
            <div className="mt-4 grid gap-2">
              <button type="button" onClick={optimizeRoute} className="btn-primary">
                Optimize Route
              </button>
              <button type="button" onClick={printableView} className="btn-secondary">
                Printable itinerary
              </button>
              <button type="button" onClick={exportJson} className="btn-secondary">
                Download itinerary JSON
              </button>
              <button type="button" onClick={exportCalendar} className="btn-secondary">
                Export to calendar (Google/Outlook)
              </button>
              <button type="button" onClick={copyShareSummary} className="btn-secondary">
                Copy sharing summary
              </button>
            </div>
            {publicShareLink && (
              <div className="app-card-soft mt-3 text-xs">
                <p className="font-semibold text-slate-700">Public sharing link</p>
                <p className="break-all text-slate-600">{publicShareLink}</p>
              </div>
            )}
          </section>
        </div>

        <section className="app-card">
          <h2 className="section-title text-lg">Time-Block Activity Scheduler</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-6">
            <select
              value={activityDraft.attractionId}
              onChange={(event) => setActivityDraft((current) => ({ ...current, attractionId: event.target.value }))}
              className="input-control md:col-span-2"
            >
              <option value="">Select attraction</option>
              {attractions.map((attraction) => (
                <option key={attraction.id} value={attraction.id}>
                  {attraction.name} ({attraction.city})
                </option>
              ))}
            </select>
            <select
              value={activityDraft.dayIndex}
              onChange={(event) => setActivityDraft((current) => ({ ...current, dayIndex: Number(event.target.value) }))}
              className="input-control"
            >
              {Array.from({ length: Math.max(1, Number(tripLength)) }, (_, index) => (
                <option key={`draft-day-${index}`} value={index}>
                  Day {index + 1}
                </option>
              ))}
            </select>
            <input
              type="time"
              value={activityDraft.start}
              onChange={(event) => setActivityDraft((current) => ({ ...current, start: event.target.value }))}
              className="input-control"
            />
            <input
              type="time"
              value={activityDraft.end}
              onChange={(event) => setActivityDraft((current) => ({ ...current, end: event.target.value }))}
              className="input-control"
            />
            <select
              value={activityDraft.mode}
              onChange={(event) => setActivityDraft((current) => ({ ...current, mode: event.target.value }))}
              className="input-control"
            >
              <option value="walk">Walk</option>
              <option value="drive">Drive</option>
              <option value="public">Public transit</option>
            </select>

            <input
              type="number"
              min="0"
              value={activityDraft.cost}
              onChange={(event) => setActivityDraft((current) => ({ ...current, cost: event.target.value }))}
              placeholder="Cost"
              className="input-control"
            />
            <select
              value={activityDraft.participantScope}
              onChange={(event) =>
                setActivityDraft((current) => ({ ...current, participantScope: event.target.value }))
              }
              className="input-control md:col-span-2"
            >
              <option value="all">All travelers</option>
              <option value="owner">Trip owner only</option>
              <option value="custom">Custom participants</option>
            </select>
            <input
              value={activityDraft.customParticipants}
              onChange={(event) =>
                setActivityDraft((current) => ({ ...current, customParticipants: event.target.value }))
              }
              placeholder="Custom participants (comma-separated)"
              className="input-control md:col-span-2"
              disabled={activityDraft.participantScope !== "custom"}
            />
            <input
              value={activityDraft.note}
              onChange={(event) => setActivityDraft((current) => ({ ...current, note: event.target.value }))}
              placeholder="Activity note"
              className="input-control"
            />
            <button type="button" onClick={addActivity} className="btn-primary md:col-span-6">
              Add activity block
            </button>
          </div>
        </section>

        <section className="app-card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title text-lg">Drag-and-Drop Itinerary Planner Calendar</h2>
            <p className="text-xs text-slate-500">Drag an activity card and drop into another day column.</p>
          </div>

          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {activitiesByDay.map((dayActivities, dayIndex) => (
              <div
                key={`day-column-${dayIndex}`}
                className={`min-w-[270px] flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-3 ${
                  draggedActivityId ? "ring-1 ring-cyan-300" : ""
                }`}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => dropOnDay(dayIndex)}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-800">Day {dayIndex + 1}</p>
                  <p className="text-xs text-slate-500">{formatDateLabel(tripDate, dayIndex)}</p>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">Drop activity cards here to reassign this day.</p>

                <div className="mt-3 space-y-2">
                  {dayActivities.map((activity) => (
                    <article
                      key={activity.id}
                      draggable
                      onDragStart={() => dragStart(activity.id)}
                      onDragEnd={dragEnd}
                      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <p className="text-sm font-semibold text-slate-800">{activity.attraction?.name || "Unknown attraction"}</p>
                      <p className="text-xs text-slate-500">
                        {activity.start} - {activity.end} | {normalizeLabel(activity.mode)} | ${activity.cost}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-600">
                        Participants: {participantLabel(activity, groupTravelerCount)}
                      </p>
                      {activity.note && <p className="mt-1 text-[11px] text-slate-600">Note: {activity.note}</p>}
                      <div className="mt-2 flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => shiftActivityTime(activity.id, -30)}
                          className="rounded bg-slate-700 px-2 py-1 font-semibold text-white"
                        >
                          Earlier 30m
                        </button>
                        <button
                          type="button"
                          onClick={() => shiftActivityTime(activity.id, 30)}
                          className="rounded bg-slate-700 px-2 py-1 font-semibold text-white"
                        >
                          Later 30m
                        </button>
                        <button
                          type="button"
                          onClick={() => removeActivity(activity.id)}
                          className="rounded bg-rose-600 px-2 py-1 font-semibold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                  {!dayActivities.length && (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-6 text-center text-xs text-slate-500">
                      No activities for this day yet.
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-8 xl:grid-cols-2">
          <section className="app-card">
            <h2 className="section-title text-lg">Travel Time Calculator</h2>
            <div className="mt-3 space-y-2 text-sm">
              {travelEstimates.map((line, index) => (
                <p key={`${line.from}-${line.to}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2 text-slate-700">
                  Day {line.day}: {line.from} to {line.to} takes about {line.travelMinutes} minutes ({normalizeLabel(line.mode)}).
                </p>
              ))}
              {!travelEstimates.length && <p className="text-slate-500">Add at least two activities in the same day to calculate travel time.</p>}
            </div>
          </section>

          <section className="app-card">
            <h2 className="section-title text-lg">Conflict Detection and Existing Itineraries</h2>
            <div className="mt-3 space-y-2 text-sm">
              {scheduleDiagnostics.conflicts.map((warning) => (
                <p key={warning} className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-700">
                  {warning}
                </p>
              ))}
              {scheduleDiagnostics.advisories.map((advisory) => (
                <p key={advisory} className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-700">
                  {advisory}
                </p>
              ))}
              {!scheduleDiagnostics.conflicts.length && !scheduleDiagnostics.advisories.length && (
                <p className="text-slate-500">No schedule conflicts detected.</p>
              )}
            </div>
            <div className="mt-4 max-h-44 space-y-2 overflow-auto pr-1 text-xs text-slate-600">
              {itineraries.map((itinerary) => (
                <div key={itinerary.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                  <p className="font-semibold text-slate-700">{itinerary.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {itinerary.tripDate || "No date"} | {itinerary.tripLength || 1} day(s) |{" "}
                    {normalizeLabel(itinerary.visibility || "private")}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Activities: {itinerary.activities?.length || 0} | Collaborators:{" "}
                    {itinerary.collaborators?.length || 0}
                  </p>
                  {itinerary.description && <p className="mt-1">{itinerary.description}</p>}
                  <button
                    type="button"
                    className="btn-secondary mt-2 w-full"
                    onClick={() => loadSavedItinerary(itinerary)}
                  >
                    Load into planner
                  </button>
                </div>
              ))}
              {!itineraries.length && <p className="text-slate-500">No saved itineraries yet.</p>}
            </div>
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
