// Test script for Staff Report Actions API & Task 7 Local Staff Authentication
const http = require('http')
const { spawn } = require('child_process')
const { hashPassword, createSignedToken } = require('./src/auth')

async function runTests() {
  const results = []
  function assert(condition, message) {
    if (!condition) {
      throw new Error(`Assertion failed: ${message}`)
    }
    results.push(`✓ ${message}`)
  }

  // TEST 1: Missing security configuration fails securely
  console.log('Testing security configuration validation (fail-secure behavior)...')
  const failPort = 5098
  const failProcess = spawn('node', ['src/server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(failPort),
      SESSION_SECRET: '',
      STAFF_EMAIL: '',
      STAFF_PASSWORD_HASH: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let failOutput = ''
  failProcess.stderr.on('data', (d) => (failOutput += d.toString()))
  failProcess.stdout.on('data', (d) => (failOutput += d.toString()))

  const failExitCode = await new Promise((resolve) => {
    failProcess.on('exit', (code) => resolve(code))
  })
  assert(failExitCode !== 0, 'Server fails to start when auth security configuration is missing')
  assert(
    failOutput.includes('Authentication security configuration error'),
    'Server outputs security configuration error on startup failure',
  )

  // TEST 2: Start server with valid test credentials
  const testPort = 5099
  const testSecret = 'campusfind_super_secret_test_key_at_least_32_chars_long!'
  const testStaffEmail = 'staff@campusfind.test'
  const testStaffPassword = 'CampusStaffTest2026!'
  const testStaffHash = hashPassword(testStaffPassword)
  const testStaffName = 'Campus Security Officer'
  const testStaffRole = 'staff'

  const serverEnv = {
    ...process.env,
    PORT: String(testPort),
    SESSION_SECRET: testSecret,
    STAFF_EMAIL: testStaffEmail,
    STAFF_PASSWORD_HASH: testStaffHash,
    STAFF_NAME: testStaffName,
    STAFF_ROLE: testStaffRole,
    TOKEN_EXPIRATION_SECONDS: '3600',
    COOKIE_SECURE: 'false',
    COOKIE_SAMESITE: 'Lax',
    FRONTEND_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
  }

  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: __dirname,
    env: serverEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let serverReady = false
  serverProcess.stdout.on('data', (d) => {
    const msg = d.toString()
    if (msg.includes('listening on port')) {
      serverReady = true
    }
  })
  serverProcess.stderr.on('data', (d) => {
    console.error('SERVER STDERR:', d.toString())
  })

  for (let i = 0; i < 40; i++) {
    if (serverReady) break
    await new Promise((r) => setTimeout(r, 100))
  }
  if (!serverReady) {
    serverProcess.kill()
    throw new Error('Server did not become ready in time')
  }

  function request(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const data = body ? JSON.stringify(body) : null
      const reqHeaders = {
        'Content-Type': 'application/json',
        Origin: 'http://localhost:5173',
        ...headers,
      }
      if (data) {
        reqHeaders['Content-Length'] = Buffer.byteLength(data)
      }
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: testPort,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let chunks = ''
          res.on('data', (chunk) => (chunks += chunk))
          res.on('end', () => {
            try {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                body: chunks ? JSON.parse(chunks) : null,
              })
            } catch (err) {
              resolve({ status: res.statusCode, raw: chunks, error: err, headers: res.headers })
            }
          })
        },
      )
      req.on('error', reject)
      if (data) req.write(data)
      req.end()
    })
  }

  try {
    // 3. UNAUTHORIZED ACCESS TESTS (Protected report endpoints return 401 without cookie)
    console.log('Testing unauthorized access to protected endpoints...')
    const unauthReports = await request('GET', '/api/reports')
    assert(unauthReports.status === 401, 'GET /api/reports without session cookie returns 401')
    assert(unauthReports.body.error.code === 'UNAUTHORIZED', 'Error code is UNAUTHORIZED')

    const unauthSingle = await request('GET', '/api/reports/CF-2041')
    assert(unauthSingle.status === 401, 'GET /api/reports/CF-2041 without cookie returns 401')

    const unauthDismiss = await request('POST', '/api/reports/CF-2041/dismiss', { reason: 'test' })
    assert(unauthDismiss.status === 401, 'POST /api/reports/CF-2041/dismiss without cookie returns 401')

    const unauthWarn = await request('POST', '/api/reports/CF-2040/warn', { reason: 'test' })
    assert(unauthWarn.status === 401, 'POST /api/reports/CF-2040/warn without cookie returns 401')

    const unauthApprove = await request('POST', '/api/reports/CF-2038/approve')
    assert(unauthApprove.status === 401, 'POST /api/reports/CF-2038/approve without cookie returns 401')

    const unauthMe = await request('GET', '/api/auth/me')
    assert(unauthMe.status === 401, 'GET /api/auth/me without cookie returns 401')

    // 4. INVALID & EXPIRED TOKENS
    console.log('Testing invalid and expired tokens...')
    const badTokenRes = await request('GET', '/api/reports', null, {
      Cookie: 'campusfind_staff_token=invalid.tampered.token',
    })
    assert(badTokenRes.status === 401, 'Tampered session token returns 401')

    const expiredToken = createSignedToken(
      {
        sessionId: 'expired-session-123',
        email: testStaffEmail,
        exp: Math.floor(Date.now() / 1000) - 300,
      },
      testSecret,
    )
    const expiredRes = await request('GET', '/api/reports', null, {
      Cookie: `campusfind_staff_token=${expiredToken}`,
    })
    assert(expiredRes.status === 401, 'Expired session token returns 401')

    // 5. LOGIN ENDPOINT VALIDATION & AUTHENTICATION
    console.log('Testing login endpoint...')
    const badBodyLogin = await request('POST', '/api/auth/login', 'not-a-json-object')
    assert(badBodyLogin.status === 400, 'Invalid request body on login returns 400')

    const emptyLogin = await request('POST', '/api/auth/login', {})
    assert(emptyLogin.status === 400, 'Empty login body returns 400')
    assert(emptyLogin.body.error.code === 'INVALID_LOGIN_INPUT', 'Error code is INVALID_LOGIN_INPUT')

    const wrongPassLogin = await request('POST', '/api/auth/login', {
      email: testStaffEmail,
      password: 'WrongPassword123!',
    })
    assert(wrongPassLogin.status === 401, 'Incorrect password returns 401')
    assert(wrongPassLogin.body.error.code === 'INVALID_CREDENTIALS', 'Error code is INVALID_CREDENTIALS')

    const wrongEmailLogin = await request('POST', '/api/auth/login', {
      email: 'intruder@campusfind.test',
      password: testStaffPassword,
    })
    assert(wrongEmailLogin.status === 401, 'Unregistered email returns 401')

    // 6. SUCCESSFUL LOGIN & COOKIE VERIFICATION
    const loginRes = await request('POST', '/api/auth/login', {
      email: testStaffEmail,
      password: testStaffPassword,
    })
    assert(loginRes.status === 200, 'Valid credentials login returns 200')
    assert(loginRes.body.status === 'ok', 'Login response status is ok')
    assert(loginRes.body.user.email === testStaffEmail, 'User email matches test staff')
    assert(loginRes.body.user.name === testStaffName, 'User name matches test staff')
    assert(loginRes.body.user.role === testStaffRole, 'User role matches test staff')
    assert(typeof loginRes.body.csrfToken === 'string', 'CSRF token returned in login response')

    const setCookie = loginRes.headers['set-cookie']
    assert(Array.isArray(setCookie) && setCookie.length > 0, 'Set-Cookie header present on login')
    const cookieHeader = setCookie[0]
    assert(cookieHeader.includes('campusfind_staff_token='), 'Cookie name is campusfind_staff_token')
    assert(cookieHeader.includes('HttpOnly'), 'Cookie has HttpOnly attribute')
    assert(cookieHeader.includes('SameSite=Lax'), 'Cookie has SameSite attribute configured')
    assert(cookieHeader.includes('Path=/'), 'Cookie has Path=/ attribute')

    const staffCookie = cookieHeader.split(';')[0]
    const csrfToken = loginRes.body.csrfToken

    // 7. GET /api/auth/me WITH VALID SESSION
    const meRes = await request('GET', '/api/auth/me', null, { Cookie: staffCookie })
    assert(meRes.status === 200, 'GET /api/auth/me with session cookie returns 200')
    assert(meRes.body.user.email === testStaffEmail, 'GET /api/auth/me returns user profile')
    assert(meRes.body.csrfToken === csrfToken, 'GET /api/auth/me returns active csrfToken')

    // 8. CSRF & ORIGIN PROTECTIONS ON STATE-CHANGING ENDPOINTS
    console.log('Testing CSRF and Origin protections on state-changing actions...')
    // Missing CSRF token
    const noCsrfRes = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { reason: 'Investigation found no issue' },
      { Cookie: staffCookie },
    )
    assert(noCsrfRes.status === 403, 'State-changing POST without CSRF token returns 403')
    assert(noCsrfRes.body.error.code === 'INVALID_CSRF_TOKEN', 'Code is INVALID_CSRF_TOKEN')

    // Invalid CSRF token
    const badCsrfRes = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { reason: 'Investigation found no issue' },
      { Cookie: staffCookie, 'X-CSRF-Token': 'fraudulent-csrf-token' },
    )
    assert(badCsrfRes.status === 403, 'State-changing POST with invalid CSRF token returns 403')

    // Disallowed Origin
    const badOriginRes = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { reason: 'Investigation found no issue' },
      {
        Cookie: staffCookie,
        'X-CSRF-Token': csrfToken,
        Origin: 'http://malicious-attacker-website.com',
      },
    )
    assert(badOriginRes.status === 403, 'State-changing POST with untrusted Origin returns 403')
    assert(badOriginRes.body.error.code === 'ORIGIN_NOT_ALLOWED', 'Code is ORIGIN_NOT_ALLOWED')

    // 9. VERIFY ALL 24 EXISTING TASK 6 TESTS UNDER AUTHENTICATED SESSION
    console.log('Running Task 6 assertions with authenticated staff session...')
    const authHeaders = {
      Cookie: staffCookie,
      'X-CSRF-Token': csrfToken,
      Origin: 'http://localhost:5173',
    }

    // 9.1 GET /api/reports
    const listRes = await request('GET', '/api/reports', null, authHeaders)
    assert(listRes.status === 200, 'GET /api/reports returns 200')
    assert(listRes.body.status === 'ok', 'GET /api/reports returns status ok')
    assert(Array.isArray(listRes.body.reports), 'reports is an array')
    assert(listRes.body.reports.length === 8, '8 initial mock reports present')

    // 9.2 Query param validation
    const invalidQuery = await request('GET', '/api/reports?badParam=123', null, authHeaders)
    assert(invalidQuery.status === 400, 'Invalid query parameter returns 400')
    assert(invalidQuery.body.error.code === 'INVALID_QUERY_PARAMETER', 'Code is INVALID_QUERY_PARAMETER')

    // 9.3 GET /api/reports/:id
    const singleRes = await request('GET', '/api/reports/CF-2041', null, authHeaders)
    assert(singleRes.status === 200, 'GET /api/reports/CF-2041 returns 200')
    assert(singleRes.body.report.id === 'CF-2041', 'Report id matches CF-2041')

    const notFoundRes = await request('GET', '/api/reports/CF-9999', null, authHeaders)
    assert(notFoundRes.status === 404, 'GET /api/reports/CF-9999 returns 404')
    assert(notFoundRes.body.error.code === 'REPORT_NOT_FOUND', 'Code is REPORT_NOT_FOUND')

    // 9.4 POST /api/reports/:id/dismiss validation & action
    const dismissNotFound = await request('POST', '/api/reports/CF-9999/dismiss', null, authHeaders)
    assert(dismissNotFound.status === 404, 'Dismiss unknown report returns 404')

    const dismissAlready = await request('POST', '/api/reports/CF-2037/dismiss', null, authHeaders)
    assert(dismissAlready.status === 409, 'Dismiss already reviewed report returns 409')
    assert(dismissAlready.body.error.code === 'REPORT_ALREADY_REVIEWED', 'Code is REPORT_ALREADY_REVIEWED')

    const dismissBadField = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { unknownField: 'val' },
      authHeaders,
    )
    assert(dismissBadField.status === 400, 'Dismiss with unsupported field returns 400')

    const dismissEmptyReason = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { reason: '   ' },
      authHeaders,
    )
    assert(dismissEmptyReason.status === 400, 'Dismiss with empty reason returns 400')

    const dismissSuccess = await request(
      'POST',
      '/api/reports/CF-2041/dismiss',
      { reason: 'Investigation found no issue (claimed earbuds verified with owner)' },
      authHeaders,
    )
    assert(dismissSuccess.status === 200, 'Dismiss CF-2041 returns 200')
    assert(dismissSuccess.body.report.reviewStatus === 'Dismissed', 'Report status changed to Dismissed')
    assert(
      dismissSuccess.body.report.dismissReason ===
        'Investigation found no issue (claimed earbuds verified with owner)',
      'Dismiss reason recorded',
    )
    assert(Boolean(dismissSuccess.body.report.dismissedAt), 'Dismissed timestamp recorded')

    const dismissAgain = await request('POST', '/api/reports/CF-2041/dismiss', null, authHeaders)
    assert(dismissAgain.status === 409, 'Dismissing already dismissed report returns 409')

    // 9.5 POST /api/reports/:id/warn validation & action
    const warnNotFound = await request('POST', '/api/reports/CF-9999/warn', null, authHeaders)
    assert(warnNotFound.status === 404, 'Warn unknown report returns 404')

    const warnBadBody = await request(
      'POST',
      '/api/reports/CF-2040/warn',
      { maliciousKey: 123 },
      authHeaders,
    )
    assert(warnBadBody.status === 400, 'Warn with unsupported field returns 400')

    const warnSuccess = await request(
      'POST',
      '/api/reports/CF-2040/warn',
      { reason: 'Inappropriate content: Report contains prank text and invalid location details.' },
      authHeaders,
    )
    assert(warnSuccess.status === 200, 'Warn CF-2040 returns 200')
    assert(warnSuccess.body.report.warningIssued === true, 'Report warningIssued is true')
    assert(
      warnSuccess.body.report.warningReason ===
        'Inappropriate content: Report contains prank text and invalid location details.',
      'Warning reason recorded',
    )
    assert(Boolean(warnSuccess.body.report.warnedAt), 'Warned timestamp recorded')

    const warnDuplicate = await request(
      'POST',
      '/api/reports/CF-2040/warn',
      { reason: 'Second warning' },
      authHeaders,
    )
    assert(warnDuplicate.status === 409, 'Second warning attempt returns 409')
    assert(warnDuplicate.body.error.code === 'REPORTER_ALREADY_WARNED', 'Code is REPORTER_ALREADY_WARNED')

    // 9.6 POST /api/reports/:id/approve
    const approveSuccess = await request('POST', '/api/reports/CF-2038/approve', null, authHeaders)
    assert(approveSuccess.status === 200, 'Approve CF-2038 returns 200')
    assert(approveSuccess.body.report.reviewStatus === 'Approved', 'Report status changed to Approved')

    // 10. PUBLIC ENDPOINTS (Must remain accessible without authentication)
    console.log('Testing public endpoints remain accessible without authentication...')
    const itemsRes = await request('GET', '/api/items')
    assert(itemsRes.status === 200, 'GET /api/items still works properly without auth')
    assert(itemsRes.body.count >= 5, 'Items list returned')

    const healthRes = await request('GET', '/api/health')
    assert(healthRes.status === 200, 'GET /api/health returns 200 without auth')
    assert(healthRes.body.status === 'ok', 'Health status is ok')

    const createItemRes = await request('POST', '/api/items', {
      type: 'Lost',
      name: 'Blue Umbrella',
      category: 'Other',
      description: 'Navy blue compact umbrella left in main canteen',
      date: '2026-10-15',
      location: 'Central Canteen Hall',
    })
    assert(createItemRes.status === 201, 'POST /api/items works without staff auth')
    assert(createItemRes.body.item.name === 'Blue Umbrella', 'Item successfully created')

    // Test custom category support on POST /api/items
    const createCustomCategoryRes = await request('POST', '/api/items', {
      type: 'Found',
      name: 'Badminton Racket',
      category: 'Other',
      customCategory: 'Sports Equipment',
      description: 'Yonex carbon fiber racket found near court 2',
      date: '2026-10-15',
      location: 'Indoor Sports Complex',
    })
    assert(createCustomCategoryRes.status === 201, 'POST /api/items with customCategory returns 201')
    assert(createCustomCategoryRes.body.item.category === 'Other', 'Item category is Other')
    assert(createCustomCategoryRes.body.item.customCategory === 'Sports Equipment', 'Custom category is preserved')

    // Validating empty custom category when category is Other
    const emptyCustomCatRes = await request('POST', '/api/items', {
      type: 'Lost',
      name: 'Yoga Mat',
      category: 'Other',
      customCategory: '   ',
      description: 'Purple yoga mat',
      date: '2026-10-15',
      location: 'Gymnasium',
    })
    assert(emptyCustomCatRes.status === 400, 'POST /api/items with empty customCategory returns 400')
    assert(emptyCustomCatRes.body.error.code === 'INVALID_ITEM', 'Code is INVALID_ITEM')
    assert(Boolean(emptyCustomCatRes.body.error.details.customCategory), 'Error details contains customCategory')

    // Validating custom category too long (> 50 chars)
    const longCustomCatRes = await request('POST', '/api/items', {
      type: 'Lost',
      name: 'Skateboard',
      category: 'Other',
      customCategory: 'A'.repeat(51),
      description: 'Wooden skateboard',
      date: '2026-10-15',
      location: 'Activity Center',
    })
    assert(longCustomCatRes.status === 400, 'POST /api/items with customCategory > 50 chars returns 400')

    // Verify GET /api/items returns the custom category item
    const getItemsWithCustom = await request('GET', '/api/items')
    const foundCustomItem = getItemsWithCustom.body.items.find((i) => i.name === 'Badminton Racket')
    assert(Boolean(foundCustomItem), 'Created item with custom category is in items list')
    assert(foundCustomItem.customCategory === 'Sports Equipment', 'Item in items list has customCategory')

    // 11. LOGOUT & SUBSEQUENT SESSION BEHAVIOR
    console.log('Testing logout and session revocation...')
    const logoutRes = await request('POST', '/api/auth/logout', null, authHeaders)
    assert(logoutRes.status === 200, 'POST /api/auth/logout returns 200')
    assert(logoutRes.body.status === 'ok', 'Logout status is ok')

    const logoutCookie = logoutRes.headers['set-cookie']?.[0] || ''
    assert(
      logoutCookie.includes('campusfind_staff_token=;') ||
        logoutCookie.includes('Max-Age=0') ||
        logoutCookie.includes('Expires='),
      'Logout clears the session cookie',
    )

    // Using the invalidated session token must now be rejected
    const meAfterLogout = await request('GET', '/api/auth/me', null, { Cookie: staffCookie })
    assert(meAfterLogout.status === 401, 'Subsequent GET /api/auth/me returns 401 after logout')

    const reportsAfterLogout = await request('GET', '/api/reports', null, { Cookie: staffCookie })
    assert(reportsAfterLogout.status === 401, 'Subsequent GET /api/reports returns 401 after logout')

    console.log('\n========================================')
    console.log(`ALL TESTS PASSED! (${results.length} assertions)`)
    console.log('========================================\n')
    results.forEach((r) => console.log(r))
  } finally {
    serverProcess.kill()
  }
}

runTests().catch((err) => {
  console.error('\nTEST ERROR OCCURRED:', err)
  process.exit(1)
})
