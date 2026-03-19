export function readStoredJson(key, fallback) {
  if (typeof window === "undefined") return fallback
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch (error) {
    return fallback
  }
}

export function writeStoredJson(key, value) {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    // Ignore storage errors and keep going.
  }
}

export function appendStoredItem(key, item, max = 30) {
  const current = readStoredJson(key, [])
  const next = [item, ...current].slice(0, max)
  writeStoredJson(key, next)
  return next
}
