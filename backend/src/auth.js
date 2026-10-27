const crypto = require('crypto')

/**
 * Hash a plain-text password using scrypt with a cryptographically secure random salt.
 * Output format: scrypt$<salt_hex>$<derived_key_hex>
 */
function hashPassword(password) {
  if (typeof password !== 'string' || !password) {
    throw new Error('Password must be a non-empty string.')
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

/**
 * Verify a plain-text password against a stored scrypt salted hash in constant time.
 */
function verifyPassword(password, storedHash) {
  if (typeof password !== 'string' || typeof storedHash !== 'string') {
    return false
  }
  if (!storedHash.startsWith('scrypt$')) {
    return false
  }
  const parts = storedHash.split('$')
  if (parts.length !== 3) {
    return false
  }
  const [, salt, expectedHex] = parts
  if (!salt || !expectedHex) {
    return false
  }
  const expectedBuffer = Buffer.from(expectedHex, 'hex')
  if (expectedBuffer.length !== 64) {
    return false
  }
  const actualBuffer = crypto.scryptSync(password, salt, 64)
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
  if (typeof token !== 'string' || !token) return null
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
    const payload = JSON.parse(base64UrlDecode(body))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && now > payload.exp) {
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

  if (!sessionSecret || sessionSecret.length < 32) {
    errors.push('SESSION_SECRET must be configured with at least 32 characters.')
  }
  if (!staffPasswordHash || !staffPasswordHash.startsWith('scrypt$')) {
    errors.push(
      'STAFF_PASSWORD_HASH must be configured with a valid scrypt salted hash (format: scrypt$<salt>$<hash>).',
    )
  }
  if (!staffEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(staffEmail)) {
    errors.push('STAFF_EMAIL must be configured with a valid email address.')
  }

  const tokenExpSeconds = Number(env.TOKEN_EXPIRATION_SECONDS) || 3600
  const isProd = env.NODE_ENV === 'production'
  const cookieSecure = env.COOKIE_SECURE === 'true' || isProd
  const cookieSameSite = env.COOKIE_SAMESITE || (isProd ? 'Strict' : 'Lax')

  return {
    isValid: errors.length === 0,
    errors,
    sessionSecret,
    staffEmail,
    staffPasswordHash,
    staffName: env.STAFF_NAME ? env.STAFF_NAME.trim() : 'Campus Safety Staff',
    staffRole: env.STAFF_ROLE ? env.STAFF_ROLE.trim() : 'staff',
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
    if (session.exp < now) {
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

    // CSRF and Origin checks for state-changing HTTP methods
    const isStateChanging = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)
    if (isStateChanging) {
      const origin = request.get('Origin')
      if (origin && !allowedFrontendOrigins.has(origin)) {
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

module.exports = {
  hashPassword,
  verifyPassword,
  createSignedToken,
  verifySignedToken,
  parseCookies,
  validateAuthConfig,
  SessionManager,
  createStaffAuthMiddleware,
}
