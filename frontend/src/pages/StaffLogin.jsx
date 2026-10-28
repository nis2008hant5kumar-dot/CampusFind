import { useState } from 'react'
import { apiBaseUrl } from '../config/api.js'
import './StaffLogin.css'

function StaffLogin({ onLoginSuccess, onCancel, notice }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const validate = () => {
    const errors = {}
    if (!email.trim()) {
      errors.email = 'Staff email is required.'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = 'Enter a valid staff email address.'
    }
    if (!password) {
      errors.password = 'Password is required.'
    }
    return errors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return
    setErrorMessage('')

    const errors = validate()
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json().catch(() => null)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid staff email or password. Please check your credentials.')
        }
        if (data?.error?.message) {
          throw new Error(data.error.message)
        }
        throw new Error(`Sign in failed (HTTP ${response.status}).`)
      }

      if (data?.status === 'ok' && data.user) {
        onLoginSuccess(data.user, data.csrfToken || '')
      } else {
        throw new Error('The server response did not confirm authentication.')
      }
    } catch (err) {
      setErrorMessage(
        err instanceof TypeError
          ? 'Unable to reach the CampusFind authentication service. Please ensure the backend server is running.'
          : err.message,
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="staff-login-page">
      <div className="staff-login-container">
        <section className="staff-login-header">
          <span className="staff-login-badge">
            <span className="badge-shield" aria-hidden="true">🛡️</span>
            Staff Portal
          </span>
          <h1>Staff sign in</h1>
          <p>
            Authorized access for campus security personnel and lost-and-found portal administrators.
          </p>
        </section>

        {notice && (
          <div className="staff-login-notice" role="status" aria-live="polite">
            <span aria-hidden="true">ℹ️</span>
            <span>{notice}</span>
          </div>
        )}

        {errorMessage && (
          <div className="staff-login-alert" role="alert" aria-live="assertive">
            <span className="alert-icon" aria-hidden="true">⚠️</span>
            <div className="alert-content">
              <strong>Sign in failed</strong>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        <form className="staff-login-form" onSubmit={handleSubmit} noValidate>
          <div className="login-field">
            <label htmlFor="staff-login-email">
              Staff email <span aria-hidden="true">*</span>
            </label>
            <input
              id="staff-login-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: '' }))
                setErrorMessage('')
              }}
              placeholder="e.g. staff@campusfind.edu"
              required
              autoFocus
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? 'staff-email-error' : undefined}
            />
            {fieldErrors.email && (
              <p className="login-field-error" id="staff-email-error">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="login-field">
            <label htmlFor="staff-login-password">
              Staff password <span aria-hidden="true">*</span>
            </label>
            <input
              id="staff-login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: '' }))
                setErrorMessage('')
              }}
              placeholder="Enter your staff password"
              required
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? 'staff-password-error' : undefined}
            />
            {fieldErrors.password && (
              <p className="login-field-error" id="staff-password-error">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <div className="staff-login-actions">
            <button
              className="button button-dark login-submit-button"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Authenticating…' : 'Sign in to Staff Portal'}
            </button>
            {onCancel && (
              <button
                className="button button-outline"
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Back to CampusFind
              </button>
            )}
          </div>
        </form>

        <div className="staff-login-footer">
          <div className="security-notice">
            <span className="security-icon" aria-hidden="true">🔒</span>
            <div>
              <strong>Protected Campus Resource</strong>
              <p>
                Staff sessions use cryptographic HttpOnly cookies and CSRF protection. In-memory sessions automatically reset if the Express server restarts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffLogin
