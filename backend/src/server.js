if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile()
  } catch (err) {
    if (err && err.code !== 'ENOENT') {
      console.warn('Notice: .env file could not be loaded:', err.message)
    }
  }
}

const express = require('express')
const { demoItems, itemStatuses, itemCategories } = require('./data/demoItems')
const {
  demoStaffReports,
  reportReviewStatuses,
  reportTypes,
} = require('./data/demoStaffReports')
const {
  validateAuthConfig,
  SessionManager,
  createStaffAuthMiddleware,
  verifyPassword,
  parseCookies,
  verifySignedToken,
} = require('./auth')

const app = express()
const port = process.env.PORT === undefined ? 5001 : Number(process.env.PORT)
let nextDemoItemNumber = demoItems.reduce((highest, item) => {
  const number = Number(item.id.match(/(\d+)$/)?.[1])
  return Number.isFinite(number) ? Math.max(highest, number) : highest
}, 0) + 1
const allowedFrontendOrigins = new Set(
  (
    process.env.FRONTEND_ORIGINS ||
    'http://localhost:5173,http://127.0.0.1:5173'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.')
}

const authConfig = validateAuthConfig(process.env)
if (!authConfig.isValid) {
  throw new Error(
    `Authentication security configuration error: ${authConfig.errors.join(' ')}`,
  )
}

const sessionManager = new SessionManager(authConfig)
const requireStaffAuth = createStaffAuthMiddleware(
  authConfig,
  sessionManager,
  allowedFrontendOrigins,
)

const cookieOptions = {
  httpOnly: true,
  secure: authConfig.cookieSecure,
  sameSite: authConfig.cookieSameSite,
  maxAge: authConfig.tokenExpSeconds * 1000,
  path: '/',
}

app.use(express.json({ limit: '16kb' }))

app.use((request, response, next) => {
  const origin = request.get('Origin')
  const isAllowedOrigin = origin && allowedFrontendOrigins.has(origin)

  if (isAllowedOrigin) {
    response.set('Access-Control-Allow-Origin', origin)
    response.set('Access-Control-Allow-Credentials', 'true')
    response.vary('Origin')
  } else if (origin) {
    return response.status(403).json({
      status: 'error',
      error: {
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'This origin is not allowed to access the CampusFind API.',
      },
    })
  }

  if (request.method === 'OPTIONS') {
    if (isAllowedOrigin) {
      response.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      response.set('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token')
      response.set('Access-Control-Allow-Credentials', 'true')
    }
    return response.status(204).end()
  }

  return next()
})

app.get('/api/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    message: 'CampusFind API is running',
  })
})

app.get('/api/items', (request, response) => {
  const { status, category } = request.query
  const errors = Object.create(null)
  const supportedParameters = ['status', 'category']

  for (const parameter of Object.keys(request.query)) {
    if (!supportedParameters.includes(parameter)) {
      errors[parameter] = 'This query parameter is not supported.'
    }
  }

  if (
    status !== undefined &&
    (typeof status !== 'string' || !itemStatuses.includes(status))
  ) {
    errors.status = `Must be one of: ${itemStatuses.join(', ')}.`
  }
  if (
    category !== undefined &&
    (typeof category !== 'string' || !itemCategories.includes(category))
  ) {
    errors.category = `Must be one of: ${itemCategories.join(', ')}.`
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_QUERY_PARAMETER',
        message: 'One or more query parameters are invalid.',
        details: errors,
      },
    })
  }

  const items = demoItems.filter((item) => (
    (status === undefined || item.status === status) &&
    (category === undefined || item.category === category)
  ))

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    count: items.length,
    items,
  })
})

app.post('/api/items', (request, response) => {
  const body = request.body
  const errors = Object.create(null)
  const allowedFields = ['type', 'name', 'category', 'customCategory', 'description', 'date', 'location']

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Provide the report details as a JSON object.',
      },
    })
  }

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors[field] = 'This field is not supported.'
    }
  }

  if (typeof body.type !== 'string' || !itemStatuses.includes(body.type)) {
    errors.type = `Must be one of: ${itemStatuses.join(', ')}.`
  }
  if (typeof body.name !== 'string' || !body.name.trim()) {
    errors.name = 'Item name is required.'
  } else if (body.name.trim().length > 100) {
    errors.name = 'Item name must be 100 characters or fewer.'
  }
  if (typeof body.category !== 'string' || !itemCategories.includes(body.category)) {
    errors.category = `Choose a supported category: ${itemCategories.join(', ')}.`
  } else if (body.category === 'Other' && body.customCategory !== undefined) {
    if (typeof body.customCategory !== 'string' || !body.customCategory.trim()) {
      errors.customCategory = 'Custom category must be a non-empty text string.'
    } else if (body.customCategory.trim().length > 50) {
      errors.customCategory = 'Custom category must be 50 characters or fewer.'
    }
  } else if (body.category !== 'Other' && body.customCategory !== undefined && body.customCategory.trim()) {
    errors.customCategory = 'Custom category is only supported when category is Other.'
  }
  if (typeof body.description !== 'string' || !body.description.trim()) {
    errors.description = 'Description is required.'
  } else if (body.description.trim().length > 700) {
    errors.description = 'Description must be 700 characters or fewer.'
  }
  const parsedDate = typeof body.date === 'string'
    ? new Date(`${body.date}T00:00:00Z`)
    : null
  const validDate = parsedDate &&
    Number.isFinite(parsedDate.getTime()) &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.date) &&
    parsedDate.toISOString().slice(0, 10) === body.date

  if (
    !validDate
  ) {
    errors.date = 'Provide a valid date in YYYY-MM-DD format.'
  } else if (body.date > new Date().toISOString().slice(0, 10)) {
    errors.date = 'Date cannot be in the future.'
  }
  if (typeof body.location !== 'string' || !body.location.trim()) {
    errors.location = 'Approximate campus location is required.'
  } else if (body.location.trim().length > 120) {
    errors.location = 'Location must be 120 characters or fewer.'
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_ITEM',
        message: 'Correct the highlighted report details and try again.',
        details: errors,
      },
    })
  }

  const item = {
    id: `demo-item-${nextDemoItemNumber}`,
    name: body.name.trim(),
    status: body.type,
    category: body.category,
    ...(body.category === 'Other' && body.customCategory && body.customCategory.trim()
      ? { customCategory: body.customCategory.trim() }
      : {}),
    description: body.description.trim(),
    location: body.location.trim(),
    reported: body.date,
  }
  nextDemoItemNumber += 1
  demoItems.unshift(item)

  return response.status(201).json({
    status: 'ok',
    source: 'demo',
    message: 'Demo item created in memory.',
    item,
  })
})

/*
  Staff Authentication API
  Note on limitation: Sessions are maintained in process memory.
  Server restart invalidates active sessions, requiring staff re-authentication.
*/

app.post('/api/auth/login', (request, response) => {
  const body = request.body || {}
  const errors = Object.create(null)

  if (typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Provide credentials as a JSON object.',
      },
    })
  }

  const { email, password } = body
  if (typeof email !== 'string' || !email.trim()) {
    errors.email = 'Staff email is required.'
  }
  if (typeof password !== 'string' || !password) {
    errors.password = 'Password is required.'
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_LOGIN_INPUT',
        message: 'Email and password are required.',
        details: errors,
      },
    })
  }

  const isEmailMatch = email.trim().toLowerCase() === authConfig.staffEmail.toLowerCase()
  const isPasswordMatch = verifyPassword(password, authConfig.staffPasswordHash)

  if (!isEmailMatch || !isPasswordMatch) {
    return response.status(401).json({
      status: 'error',
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid staff email or password.',
      },
    })
  }

  const user = {
    email: authConfig.staffEmail,
    name: authConfig.staffName,
    role: authConfig.staffRole,
  }
  const { token, csrfToken } = sessionManager.createSession(user)

  response.cookie('campusfind_staff_token', token, cookieOptions)

  return response.status(200).json({
    status: 'ok',
    message: 'Staff login successful.',
    user,
    csrfToken,
  })
})

app.post('/api/auth/logout', (request, response) => {
  const cookies = parseCookies(request.headers.cookie)
  const token = cookies.campusfind_staff_token
  if (token) {
    const payload = verifySignedToken(token, authConfig.sessionSecret)
    if (payload?.sessionId) {
      sessionManager.revokeSession(payload.sessionId)
    }
  }

  response.clearCookie('campusfind_staff_token', {
    httpOnly: true,
    secure: authConfig.cookieSecure,
    sameSite: authConfig.cookieSameSite,
    path: '/',
  })

  return response.status(200).json({
    status: 'ok',
    message: 'Logged out successfully.',
  })
})

app.get('/api/auth/me', requireStaffAuth, (request, response) => {
  return response.status(200).json({
    status: 'ok',
    user: {
      email: request.staffUser.email,
      name: request.staffUser.name,
      role: request.staffUser.role,
    },
    csrfToken: request.staffUser.csrfToken,
  })
})

/*
  Staff Reports API
  Protected by staff-authentication middleware.
  Operates on in-memory demo records (database persistence pending).
*/

app.get('/api/reports', requireStaffAuth, (request, response) => {
  const { status, type, search } = request.query
  const errors = Object.create(null)
  const supportedParameters = ['status', 'type', 'search']

  for (const parameter of Object.keys(request.query)) {
    if (!supportedParameters.includes(parameter)) {
      errors[parameter] = 'This query parameter is not supported.'
    }
  }

  if (
    status !== undefined &&
    (typeof status !== 'string' || !reportReviewStatuses.includes(status))
  ) {
    errors.status = `Must be one of: ${reportReviewStatuses.join(', ')}.`
  }
  if (
    type !== undefined &&
    (typeof type !== 'string' || !reportTypes.includes(type))
  ) {
    errors.type = `Must be one of: ${reportTypes.join(', ')}.`
  }
  if (search !== undefined && typeof search !== 'string') {
    errors.search = 'Search query must be a string.'
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_QUERY_PARAMETER',
        message: 'One or more query parameters are invalid.',
        details: errors,
      },
    })
  }

  const query = search ? search.trim().toLowerCase() : ''
  const reports = demoStaffReports.filter((report) => {
    if (status !== undefined && report.reviewStatus !== status) return false
    if (type !== undefined && report.type !== type) return false
    if (query && !report.itemName.toLowerCase().includes(query) && !report.id.toLowerCase().includes(query)) {
      return false
    }
    return true
  })

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    count: reports.length,
    reports,
  })
})

app.get('/api/reports/:id', requireStaffAuth, (request, response) => {
  const { id } = request.params
  const report = demoStaffReports.find((entry) => entry.id === id)

  if (!report) {
    return response.status(404).json({
      status: 'error',
      error: {
        code: 'REPORT_NOT_FOUND',
        message: `Report "${id}" was not found.`,
      },
    })
  }

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    report,
  })
})

// Staff Action: Dismiss report (when investigation finds no issue)
app.post('/api/reports/:id/dismiss', requireStaffAuth, (request, response) => {
  const { id } = request.params
  const report = demoStaffReports.find((entry) => entry.id === id)

  if (!report) {
    return response.status(404).json({
      status: 'error',
      error: {
        code: 'REPORT_NOT_FOUND',
        message: `Report "${id}" was not found.`,
      },
    })
  }

  if (report.reviewStatus !== 'Pending review') {
    return response.status(409).json({
      status: 'error',
      error: {
        code: 'REPORT_ALREADY_REVIEWED',
        message: `Report "${id}" has already been reviewed with status "${report.reviewStatus}".`,
      },
    })
  }

  const body = request.body || {}
  const errors = Object.create(null)
  const allowedFields = ['reason']

  if (typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Provide dismissal details as a JSON object.',
      },
    })
  }

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors[field] = 'This field is not supported.'
    }
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      errors.reason = 'Dismissal reason must be a non-empty text string.'
    } else if (body.reason.trim().length > 500) {
      errors.reason = 'Dismissal reason must be 500 characters or fewer.'
    }
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_DISMISSAL_REQUEST',
        message: 'Invalid report dismissal parameters.',
        details: errors,
      },
    })
  }

  const reason = (body.reason && body.reason.trim()) || 'Investigation found no issue'
  report.reviewStatus = 'Dismissed'
  report.dismissReason = reason
  report.dismissedAt = new Date().toISOString()

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    message: `Report "${id}" has been dismissed: ${reason}.`,
    report,
  })
})

// Staff Action: Warn reporter (when report is inappropriate)
app.post('/api/reports/:id/warn', requireStaffAuth, (request, response) => {
  const { id } = request.params
  const report = demoStaffReports.find((entry) => entry.id === id)

  if (!report) {
    return response.status(404).json({
      status: 'error',
      error: {
        code: 'REPORT_NOT_FOUND',
        message: `Report "${id}" was not found.`,
      },
    })
  }

  if (report.warningIssued) {
    return response.status(409).json({
      status: 'error',
      error: {
        code: 'REPORTER_ALREADY_WARNED',
        message: `A warning has already been issued to the reporter for report "${id}".`,
      },
    })
  }

  const body = request.body || {}
  const errors = Object.create(null)
  const allowedFields = ['reason']

  if (typeof body !== 'object' || Array.isArray(body)) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_REQUEST_BODY',
        message: 'Provide warning details as a JSON object.',
      },
    })
  }

  for (const field of Object.keys(body)) {
    if (!allowedFields.includes(field)) {
      errors[field] = 'This field is not supported.'
    }
  }

  if (body.reason !== undefined) {
    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      errors.reason = 'Warning reason must be a non-empty text string.'
    } else if (body.reason.trim().length > 500) {
      errors.reason = 'Warning reason must be 500 characters or fewer.'
    }
  }

  if (Object.keys(errors).length > 0) {
    return response.status(400).json({
      status: 'error',
      error: {
        code: 'INVALID_WARNING_REQUEST',
        message: 'Invalid reporter warning parameters.',
        details: errors,
      },
    })
  }

  const reason = (body.reason && body.reason.trim()) || 'Inappropriate report: content violates campus reporting guidelines'
  report.warningIssued = true
  report.warningReason = reason
  report.warnedAt = new Date().toISOString()

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    message: `Warning issued to reporter for report "${id}": ${reason}.`,
    report,
  })
})

// Staff Action: Approve report
app.post('/api/reports/:id/approve', requireStaffAuth, (request, response) => {
  const { id } = request.params
  const report = demoStaffReports.find((entry) => entry.id === id)

  if (!report) {
    return response.status(404).json({
      status: 'error',
      error: {
        code: 'REPORT_NOT_FOUND',
        message: `Report "${id}" was not found.`,
      },
    })
  }

  if (report.reviewStatus !== 'Pending review') {
    return response.status(409).json({
      status: 'error',
      error: {
        code: 'REPORT_ALREADY_REVIEWED',
        message: `Report "${id}" has already been reviewed with status "${report.reviewStatus}".`,
      },
    })
  }

  report.reviewStatus = 'Approved'

  return response.status(200).json({
    status: 'ok',
    source: 'demo',
    message: `Report "${id}" approved successfully.`,
    report,
  })
})

app.use('/api', (_request, response) => {
  response.status(404).json({
    status: 'error',
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API route was not found.',
    },
  })
})

app.use((error, _request, response, _next) => {
  if (error.status !== 400) {
    console.error('Unhandled API error:', error)
  }
  const statusCode = error.status === 400 ? 400 : 500
  const isBadRequest = statusCode === 400

  response.status(statusCode).json({
    status: 'error',
    error: {
      code: isBadRequest ? 'BAD_REQUEST' : 'INTERNAL_SERVER_ERROR',
      message: isBadRequest
        ? 'The request could not be processed.'
        : 'An unexpected server error occurred.',
    },
  })
})

app.listen(port, () => {
  console.log(`CampusFind API listening on port ${port}`)
})