const crypto = require('crypto')

const scryptSaltLength = 16
const scryptKeyLength = 64
const scryptOptions = { N: 16384, r: 8, p: 1 }
const minimumTokenExpirationSeconds = 60
const maximumTokenExpirationSeconds = 86400

function hasShortRepeatingPattern(value) {
  for (let size = 1; size <= Math.min(16, Math.floor(value.length / 2)); size += 1) {
    if (value.length % size !== 0) continue
    const pattern = value.slice(0, size)
    if (pattern.repeat(value.length / size) === value) return true
  }
  return false
}

/**
 * Hash a plain-text password using scrypt with a cryptographically secure random salt.
 * Output format: scrypt$<salt_hex>$<derived_key_hex>
 */
function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string.')
  }
  const salt = crypto.randomBytes(scryptSaltLength).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, scryptKeyLength, scryptOptions)
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

/**
 * Verify a plain-text password against a stored scrypt salted hash in constant time.
 */
function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false
  }
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(storedHash)
  if (!match) {
    return false
  }
  const [, salt, expectedHex] = match
  const expectedBuffer = Buffer.from(expectedHex, 'hex')
  const actualBuffer = crypto.scryptSync(password, salt, scryptKeyLength, scryptOptions)
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

function base64UrlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64url')
}

function base64UrlDecode(str) {
  return Buffer.from(str, 'base64url').toString('utf8')
}

/**
 * Create a cryptographically signed HMAC-SHA256 token.
 */
function createSignedToken(payload, secret) {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64UrlEncode(JSON.stringify(payload))
  const data = `${header}.${body}`
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${signature}`
}

/**
 * Verify a signed token signature and expiration in constant time.
 */
function verifySignedToken(token, secret) {
  if (typeof token !== 'string' || !token || token.length > 4096) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts
  const data = `${header}.${body}`
  const expectedSig = crypto.createHmac('sha256', secret).update(data).digest('base64url')
  const sigBuf = Buffer.from(signature)
  const expSigBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return null
  }
  try {
    const parsedHeader = JSON.parse(base64UrlDecode(header))
    if (parsedHeader.alg !== 'HS256' || parsedHeader.typ !== 'JWT') {
      return null
    }
    const payload = JSON.parse(base64UrlDecode(body))
    const now = Math.floor(Date.now() / 1000)
    if (
      !payload ||
      typeof payload !== 'object' ||
      typeof payload.sessionId !== 'string' ||
      !/^[a-f0-9]{48}$/i.test(payload.sessionId) ||
      !Number.isInteger(payload.iat) ||
      !Number.isInteger(payload.exp) ||
      payload.iat > now + 60 ||
      payload.exp <= now ||
      payload.exp <= payload.iat
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

/**
 * Parse Cookie header into a key-value object safely.
 */
function parseCookies(header) {
  const cookies = Object.create(null)
  if (!header || typeof header !== 'string') return cookies
  const pairs = header.split(';')
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx === -1) continue
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    try {
      cookies[key] = decodeURIComponent(val)
    } catch {
      cookies[key] = val
    }
  }
  return cookies
}

/**
 * Validate required staff authentication security configuration.
 * Fails securely if required settings are missing or weak.
 */
function validateAuthConfig(env = process.env) {
  const errors = []
  const sessionSecret = env.SESSION_SECRET ? env.SESSION_SECRET.trim() : ''
  const staffEmail = env.STAFF_EMAIL ? env.STAFF_EMAIL.trim().toLowerCase() : ''
  const staffPasswordHash = env.STAFF_PASSWORD_HASH ? env.STAFF_PASSWORD_HASH.trim() : ''
  const secretCharacterCounts = [...sessionSecret].reduce((counts, character) => {
    counts[character] = (counts[character] || 0) + 1
    return counts
  }, Object.create(null))
  const secretEntropy = sessionSecret.length > 0
    ? Object.values(secretCharacterCounts).reduce((entropy, count) => {
      const probability = count / sessionSecret.length
      return entropy - probability * Math.log2(probability)
    }, 0) * sessionSecret.length
    : 0
  const knownPlaceholder = /replace[_ -]?with|change[_ -]?me|placeholder|example|your[_ -]?secret|default/i
    .test(sessionSecret)

  if (
    sessionSecret.length < 32 ||
    knownPlaceholder ||
    hasShortRepeatingPattern(sessionSecret) ||
    Object.keys(secretCharacterCounts).length < 16 ||
    secretEntropy < 128
  ) {
    errors.push(
      'SESSION_SECRET must be a high-entropy random value of at least 32 characters; do not use a placeholder.',
    )
  }
  if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(staffPasswordHash)) {
    errors.push(
      'STAFF_PASSWORD_HASH must be a valid scrypt hash with a 16-byte salt and 64-byte derived key.',
    )
  }
  if (!staffEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
    errors.push('STAFF_EMAIL must be configured with a valid email address.')
  }

  const tokenExpSeconds = env.TOKEN_EXPIRATION_SECONDS === undefined
    ? 3600
    : Number(env.TOKEN_EXPIRATION_SECONDS)
  if (
    !Number.isInteger(tokenExpSeconds) ||
    tokenExpSeconds < minimumTokenExpirationSeconds ||
    tokenExpSeconds > maximumTokenExpirationSeconds
  ) {
    errors.push(
      `TOKEN_EXPIRATION_SECONDS must be an integer between ${minimumTokenExpirationSeconds} and ${maximumTokenExpirationSeconds}.`,
    )
  }

  const isProd = env.NODE_ENV === 'production'
  const secureSetting = env.COOKIE_SECURE === undefined
    ? (isProd ? 'true' : 'false')
    : String(env.COOKIE_SECURE).toLowerCase()
  if (!['true', 'false'].includes(secureSetting)) {
    errors.push('COOKIE_SECURE must be either true or false.')
  }
  const cookieSecure = secureSetting === 'true' || isProd
  const sameSiteSetting = env.COOKIE_SAMESITE === undefined
    ? (isProd ? 'Strict' : 'Lax')
    : String(env.COOKIE_SAMESITE).toLowerCase()
  const sameSiteValues = { lax: 'Lax', strict: 'Strict', none: 'None' }
  const cookieSameSite = sameSiteValues[sameSiteSetting]
  if (!cookieSameSite) {
    errors.push('COOKIE_SAMESITE must be Lax, Strict, or None.')
  } else if (cookieSameSite === 'None' && !cookieSecure) {
    errors.push('COOKIE_SAMESITE=None requires COOKIE_SECURE=true.')
  }
  const staffRole = env.STAFF_ROLE ? env.STAFF_ROLE.trim() : 'staff'
  if (staffRole !== 'staff') {
    errors.push('STAFF_ROLE must be staff for this local staff account.')
  }

  return {
    isValid: errors.length === 0,
    errors,
    sessionSecret,
    staffEmail,
    staffPasswordHash,
    staffName: env.STAFF_NAME ? env.STAFF_NAME.trim() : 'Campus Safety Staff',
    staffRole,
    tokenExpSeconds,
    cookieSecure,
    cookieSameSite,
  }
}

/**
 * In-memory active session store.
 * Note on limitation: Sessions are maintained in process memory.
 * Server restart invalidates active sessions, requiring staff re-authentication.
 */
class SessionManager {
  constructor(authConfig) {
    this.authConfig = authConfig
    this.sessions = new Map() // sessionId -> sessionData
  }

  createSession(user) {
    const sessionId = crypto.randomBytes(24).toString('hex')
    const csrfToken = crypto.randomBytes(32).toString('hex')
    const now = Math.floor(Date.now() / 1000)
    const exp = now + this.authConfig.tokenExpSeconds

    const payload = {
      sessionId,
      email: user.email,
      name: user.name,
      role: user.role,
      csrfToken,
      iat: now,
      exp,
    }

    const token = createSignedToken(payload, this.authConfig.sessionSecret)
    const sessionData = {
      sessionId,
      email: user.email,
      name: user.name,
      role: user.role,
      csrfToken,
      exp,
    }

    this.sessions.set(sessionId, sessionData)
    return { token, csrfToken, session: sessionData }
  }

  getSession(sessionId) {
    if (!sessionId || !this.sessions.has(sessionId)) return null
    const session = this.sessions.get(sessionId)
    const now = Math.floor(Date.now() / 1000)
    if (session.exp <= now) {
      this.sessions.delete(sessionId)
      return null
    }
    return session
  }

  revokeSession(sessionId) {
    if (sessionId) {
      this.sessions.delete(sessionId)
    }
  }

  clear() {
    this.sessions.clear()
  }
}

/**
 * Reusable staff authentication and CSRF protection middleware.
 */
function createStaffAuthMiddleware(authConfig, sessionManager, allowedFrontendOrigins) {
  return function requireStaffAuth(request, response, next) {
    const cookies = parseCookies(request.headers.cookie)
    const token = cookies.campusfind_staff_token

    if (!token) {
      return response.status(401).json({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Staff authentication required. No session cookie found.',
        },
      })
    }

    const payload = verifySignedToken(token, authConfig.sessionSecret)
    if (!payload || !payload.sessionId) {
      return response.status(401).json({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or expired staff session.',
        },
      })
    }

    const session = sessionManager.getSession(payload.sessionId)
    if (!session) {
      return response.status(401).json({
        status: 'error',
        error: {
          code: 'UNAUTHORIZED',
          message: 'Session has expired or was revoked. Please log in again.',
        },
      })
    }

    if (
      payload.exp !== session.exp ||
      payload.role !== session.role ||
      payload.email !== session.email ||
      session.role !== 'staff'
    ) {
      return response.status(403).json({
        status: 'error',
        error: {
          code: 'FORBIDDEN',
          message: 'A staff role is required to access this resource.',
        },
      })
    }

    // CSRF and Origin checks for state-changing HTTP methods
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)
    if (isStateChanging) {
      const origin = request.get('Origin')
      if (!origin || !allowedFrontendOrigins.has(origin)) {
        return response.status(403).json({
          status: 'error',
          error: {
            code: 'ORIGIN_NOT_ALLOWED',
            message: 'Origin not allowed for authenticated state-changing action.',
          },
        })
      }

      const clientCsrfToken = request.get('X-CSRF-Token')
      if (!clientCsrfToken || clientCsrfToken !== session.csrfToken) {
        return response.status(403).json({
          status: 'error',
          error: {
            code: 'INVALID_CSRF_TOKEN',
            message: 'Invalid or missing CSRF token.',
          },
        })
      }
    }

    request.staffUser = {
      email: session.email,
      name: session.name,
      role: session.role,
      sessionId: session.sessionId,
      csrfToken: session.csrfToken,
    }

    return next()
  }
}

function createLoginRateLimiter({ limit = 10, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map()

  const middleware = (request, response, next) => {
    const now = Date.now()
    const key = request.socket?.remoteAddress || 'unknown'
    let entry = attempts.get(key)

    if (!entry || now - entry.startedAt >= windowMs) {
      entry = { count: 0, startedAt: now }
      attempts.set(key, entry)
    }

    if (entry.count >= limit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((windowMs - (now - entry.startedAt)) / 1000),
      )
      response.set('Retry-After', String(retryAfterSeconds))
      return response.status(429).json({
        status: 'error',
        error: {
          code: 'LOGIN_RATE_LIMITED',
          message: 'Too many sign-in attempts. Please wait before trying again.',
        },
      })
    }

    entry.count += 1
    if (attempts.size > 1000) {
      for (const [address, value] of attempts) {
        if (now - value.startedAt >= windowMs) attempts.delete(address)
      }
    }
    return next()
  }

  middleware.clear = (request) => {
    attempts.delete(request.socket?.remoteAddress || 'unknown')
  }

  return middleware
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSignedToken,
  verifySignedToken,
  parseCookies,
  validateAuthConfig,
  SessionManager,
  createStaffAuthMiddleware,
  createLoginRateLimiter,
}
