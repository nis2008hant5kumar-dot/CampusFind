const express = require('express')
const { demoItems, itemStatuses, itemCategories } = require('./data/demoItems')

const app = express()
const port = process.env.PORT === undefined ? 5000 : Number(process.env.PORT)
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

app.use(express.json({ limit: '16kb' }))

app.use((request, response, next) => {
  const origin = request.get('Origin')
  const isAllowedOrigin = origin && allowedFrontendOrigins.has(origin)

  if (isAllowedOrigin) {
    response.set('Access-Control-Allow-Origin', origin)
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
      response.set('Access-Control-Allow-Headers', 'Content-Type')
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
  const allowedFields = ['type', 'name', 'category', 'description', 'date', 'location']

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
  console.error('Unhandled API error:', error)
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