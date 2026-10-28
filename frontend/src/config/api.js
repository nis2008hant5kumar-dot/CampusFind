const defaultApiHost =
  import.meta.env.DEV && typeof window !== 'undefined' ? window.location.hostname : 'localhost'

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || `http://${defaultApiHost}:5001`
).replace(/\/+$/, '')
