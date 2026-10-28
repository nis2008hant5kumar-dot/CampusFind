import { useCallback, useEffect, useRef, useState } from 'react'
import campusImage from './assets/lpu-campus.png'
import { apiBaseUrl } from './config/api.js'
import BrowseItems from './pages/BrowseItems.jsx'
import ReportItem from './pages/ReportItem.jsx'
import StaffLogin from './pages/StaffLogin.jsx'
import StaffDashboard from './pages/StaffDashboard.jsx'
import './App.css'

const categories = [
  {
    name: 'Electronics',
    description: 'Phones, headphones, chargers and more',
    icon: 'electronics',
    tone: 'blue',
  },
  {
    name: 'Cards & Wallets',
    description: 'Wallets, ID cards and card holders',
    icon: 'wallet',
    tone: 'sand',
  },
  {
    name: 'Bags & Personal Items',
    description: 'Backpacks, bottles and everyday essentials',
    icon: 'bag',
    tone: 'green',
  },
  {
    name: 'Other Belongings',
    description: 'Keys, books and things in between',
    icon: 'spark',
    tone: 'lilac',
  },
]

const steps = [
  {
    number: '01',
    title: 'Report an item',
    description:
      'Tell the campus community what you lost or found. A simple description is a great start.',
    icon: 'report',
  },
  {
    number: '02',
    title: 'Browse and identify',
    description:
      'Look through item categories and descriptions to find a possible match.',
    icon: 'search',
  },
  {
    number: '03',
    title: 'Verify ownership',
    description:
      'The right details help staff verify a claim before an item is returned.',
    icon: 'shield',
  },
]

function Icon({ name, className = '' }) {
  const common = {
    className,
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (name) {
    case 'logo':
      return (
        <svg {...common}>
          <path d="M12 2.8 21 8v8l-9 5.2L3 16V8l9-5.2Z" />
          <path d="m3.5 8.2 8.5 5 8.5-5M12 13.2v7.5M8 5.1l8.8 5.1" />
          <path d="m16.6 14.3 4.1 4.1" />
        </svg>
      )
    case 'electronics':
      return (
        <svg {...common}>
          <rect x="3.2" y="4.3" width="17.6" height="12.4" rx="2" />
          <path d="M8.5 20h7M12 16.8V20" />
          <path d="M8.3 8h7.4M8.3 11.5h4.8" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="15" rx="2.5" />
          <path d="M3.5 9h17M16 14h.1M6.5 5V3.5h11V5" />
        </svg>
      )
    case 'bag':
      return (
        <svg {...common}>
          <path d="M5 8h14l1.3 12H3.7L5 8Z" />
          <path d="M9 8V6a3 3 0 0 1 6 0v2M8 12v.1M16 12v.1" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
          <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15ZM5 3v3M3.5 4.5h3" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="10.8" cy="10.8" r="6.8" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 3 20 6v5.5c0 4.5-3.2 7.7-8 9.5-4.8-1.8-8-5-8-9.5V6l8-3Z" />
          <path d="m8.5 12 2.2 2.2 4.8-4.8" />
        </svg>
      )
    case 'report':
      return (
        <svg {...common}>
          <path d="M5 3.5h9l5 5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
          <path d="M14 3.8V9h5M8 13h8M8 16.5h5" />
        </svg>
      )
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      )
    default:
      return null
  }
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [currentPath, setCurrentPath] = useState(window.location.pathname)
  const [authStatus, setAuthStatus] = useState('checking')
  const [staffUser, setStaffUser] = useState(null)
  const [csrfToken, setCsrfToken] = useState('')
  const [authNotice, setAuthNotice] = useState('')
  const authCheckController = useRef(null)
  const isBrowsePage = currentPath === '/browse'
  const isReportPage = currentPath === '/report'
  const isStaffPage = currentPath === '/staff'
  const isStaffLoginPage = currentPath === '/staff/login'
  const isHomePage = !isBrowsePage && !isReportPage && !isStaffPage && !isStaffLoginPage

  function setPath(path, replace = false) {
    if (window.location.pathname !== path) {
      if (replace) window.history.replaceState({}, '', path)
      else window.history.pushState({}, '', path)
      setCurrentPath(path)
      window.scrollTo(0, 0)
    }
    setMenuOpen(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    authCheckController.current = controller

    const checkSession = async () => {
      try {
        const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
          credentials: 'include',
          signal: controller.signal,
        })
        if (response.status === 401) {
          if (window.location.pathname === '/staff') {
            setAuthNotice('Please sign in with an authorized staff account.')
            setPath('/staff/login', true)
          }
          setAuthStatus('unauthenticated')
          return
        }
        if (!response.ok) {
          throw new Error(`Session check failed (HTTP ${response.status}).`)
        }

        const payload = await response.json()
        if (
          payload?.status !== 'ok' ||
          payload.user?.role !== 'staff' ||
          typeof payload.csrfToken !== 'string' ||
          !payload.csrfToken
        ) {
          setAuthStatus('unauthenticated')
          setAuthNotice('The server did not confirm an authorized staff session.')
          return
        }
        setStaffUser(payload.user)
        setCsrfToken(payload.csrfToken)
        setAuthStatus('authenticated')
        if (window.location.pathname === '/staff/login') {
          setPath('/staff', true)
        }
      } catch (error) {
        if (error.name === 'AbortError') return
        setAuthStatus('unavailable')
        if (window.location.pathname === '/staff') {
          setPath('/staff/login', true)
        }
        setAuthNotice(
          error instanceof TypeError
            ? 'Unable to verify a staff session. Check that the backend is running.'
            : error.message,
        )
      }
    }

    checkSession()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      if (path === '/staff' && authStatus !== 'authenticated') {
        window.history.replaceState({}, '', '/staff/login')
        setCurrentPath('/staff/login')
        setAuthNotice('Please sign in with an authorized staff account.')
      } else if (path === '/staff/login' && authStatus === 'authenticated') {
        window.history.replaceState({}, '', '/staff')
        setCurrentPath('/staff')
      } else {
        setCurrentPath(path)
      }
      setMenuOpen(false)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [authStatus])

  const navigateTo = (event, path) => {
    event.preventDefault()
    if (path === '/staff' && authStatus !== 'authenticated') {
      setAuthNotice('')
      setPath('/staff/login')
    } else {
      setPath(path)
    }
  }

  const handleLoginSuccess = (user, token) => {
    if (user?.role !== 'staff' || typeof token !== 'string' || !token) {
      setAuthStatus('unauthenticated')
      setAuthNotice('The server did not confirm an authorized staff session.')
      return
    }
    authCheckController.current?.abort()
    setStaffUser(user)
    setCsrfToken(token)
    setAuthStatus('authenticated')
    setAuthNotice('')
    setPath('/staff')
  }

  const handleLogout = useCallback(async (message = '') => {
    let logoutWarning = ''
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : {},
        credentials: 'include',
      })
      if (!response.ok) {
        logoutWarning = 'The server could not confirm session revocation. Please try signing out again when it is available.'
      }
    } catch {
      logoutWarning = 'The server could not be reached to revoke the session. Please try signing out again when it is available.'
    }
    setStaffUser(null)
    setCsrfToken('')
    setAuthStatus('unauthenticated')
    setAuthNotice(message || logoutWarning || 'You have signed out.')
    setPath('/staff/login')
  }, [csrfToken])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="header-inner">
          <a
            className="brand"
            href="/"
            aria-label="CampusFind home"
            onClick={(event) => navigateTo(event, '/')}
          >
            <span className="brand-mark">
              <Icon name="logo" />
            </span>
            <span className="brand-copy">
              <span className="brand-name">CampusFind</span>
              <span className="brand-tagline">Lost Today. Found Together.</span>
            </span>
          </a>

          <button
            className="menu-toggle"
            type="button"
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>

          <nav
            className={`primary-navigation${menuOpen ? ' is-open' : ''}`}
            id="primary-navigation"
            aria-label="Main navigation"
          >
            <a
              className={`nav-link${isHomePage ? ' is-current' : ''}`}
              href="/"
              aria-current={isHomePage ? 'page' : undefined}
              onClick={(event) => navigateTo(event, '/')}
            >
              Home
            </a>
            <a
              className={`nav-link${isBrowsePage ? ' is-current' : ''}`}
              href="/browse"
              aria-current={isBrowsePage ? 'page' : undefined}
              onClick={(event) => navigateTo(event, '/browse')}
            >
              Browse Items
            </a>
            <a
              className={`nav-link staff-demo-link${isStaffPage || isStaffLoginPage ? ' is-current' : ''}`}
              href="/staff"
              aria-current={isStaffPage || isStaffLoginPage ? 'page' : undefined}
              onClick={(event) => navigateTo(event, '/staff')}
            >
              Staff dashboard
            </a>
            <a
              className="nav-link"
              href={isHomePage ? '#how-it-works' : '/#how-it-works'}
              onClick={closeMenu}
            >
              How It Works
            </a>
            {authStatus === 'authenticated' ? (
              <button
                className="button button-quiet nav-sign-in"
                type="button"
                onClick={() => handleLogout()}
              >
                Sign out
              </button>
            ) : (
              <button
                className="button button-quiet nav-sign-in"
                type="button"
                onClick={() => {
                  setAuthNotice('')
                  setPath('/staff/login')
                }}
              >
                Staff sign in
              </button>
            )}
            <a
              className={`button button-dark nav-report${isReportPage ? ' is-current' : ''}`}
              href="/report"
              aria-current={isReportPage ? 'page' : undefined}
              onClick={(event) => navigateTo(event, '/report')}
            >
              Report an Item
              <Icon name="arrow" />
            </a>
          </nav>
        </div>
      </header>

      {notice && (
        <div className="demo-notice" role="status">
          <span>{notice}</span>
          <button
            className="notice-dismiss"
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice('')}
          >
            <Icon name="close" />
          </button>
        </div>
      )}

      <main>
        {isBrowsePage ? (
          <BrowseItems />
        ) : isReportPage ? (
          <ReportItem onCancel={(event) => navigateTo(event, '/browse')} />
        ) : isStaffPage ? (
          authStatus === 'authenticated' ? (
            <StaffDashboard
              staffUser={staffUser}
              csrfToken={csrfToken}
              onLogout={handleLogout}
            />
          ) : (
            <div className="staff-auth-loading" role="status" aria-live="polite">
              Checking staff session…
            </div>
          )
        ) : isStaffLoginPage ? (
          <StaffLogin
            onLoginSuccess={handleLoginSuccess}
            onCancel={(event) => navigateTo(event, '/')}
            notice={authNotice}
          />
        ) : (
          <>
        <section className="hero-section" id="home" aria-labelledby="hero-heading">
          <div className="hero-content">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              A kinder campus starts here
            </p>
            <h1 id="hero-heading">
              Lost something?
              <br />
              <span>Let&apos;s find it together.</span>
            </h1>
            <p className="hero-description">
              CampusFind helps our campus community reconnect with lost
              belongings through one simple, thoughtful place.
            </p>
            <div className="hero-actions">
              <a
                className="button button-dark button-large"
                href="/browse"
                onClick={(event) => navigateTo(event, '/browse')}
              >
                Browse Found Items
                <Icon name="arrow" />
              </a>
              <a
                className="button button-outline button-large"
                href="/report"
                onClick={(event) => navigateTo(event, '/report')}
              >
                <Icon name="report" />
                Report Lost Item
              </a>
            </div>
            <div className="hero-footnote">
              <span className="footnote-mark" aria-hidden="true">✳</span>
              Built for a more connected campus community
            </div>
          </div>

          <div className="campus-photo">
            <img
              src={campusImage}
              alt="Aerial view of Lovely Professional University campus"
            />
            <span className="campus-photo-label">Our Campus</span>
          </div>
        </section>

        <section className="trust-strip" aria-label="CampusFind principles">
          <article className="trust-item">
            <span className="trust-icon trust-icon-blue"><Icon name="search" /></span>
            <span>
              <strong>Easy discovery</strong>
              <small>Find a match without the runaround.</small>
            </span>
          </article>
          <article className="trust-item">
            <span className="trust-icon trust-icon-green"><Icon name="shield" /></span>
            <span>
              <strong>Safer claims</strong>
              <small>Ownership is verified before return.</small>
            </span>
          </article>
          <article className="trust-item">
            <span className="trust-icon trust-icon-sand"><Icon name="spark" /></span>
            <span>
              <strong>Community support</strong>
              <small>Good neighbors help good things get found.</small>
            </span>
          </article>
        </section>

        <section className="categories-section section-block" id="categories" aria-labelledby="categories-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A place for every little thing</p>
              <h2 id="categories-heading">What are you looking for?</h2>
            </div>
            <p className="section-intro">
              Start with a category to explore. Live item listings are not
              connected in this homepage demo.
            </p>
          </div>
          <div className="category-grid">
            {categories.map((category) => (
              <article className="category-card" key={category.name}>
                <span className={`category-icon tone-${category.tone}`}>
                  <Icon name={category.icon} />
                </span>
                <h3>{category.name}</h3>
                <p>{category.description}</p>
                <span className="category-arrow" aria-hidden="true">
                  <Icon name="arrow" />
                </span>
              </article>
            ))}
          </div>
        </section>

        <section className="how-section section-block" id="how-it-works" aria-labelledby="how-heading">
          <div className="how-intro">
            <p className="eyebrow">Simple by design</p>
            <h2 id="how-heading">A little lost.<br />A lot more found.</h2>
            <p>
              Getting belongings back should feel simple. CampusFind brings
              each step together, with care for the people behind every item.
            </p>
            <a className="text-link" href="#home">
              Back to the top <Icon name="arrow" />
            </a>
          </div>
          <div className="steps-list">
            {steps.map((step) => (
              <article className="step-card" key={step.number}>
                <span className="step-number">{step.number}</span>
                <span className="step-icon"><Icon name={step.icon} /></span>
                <div className="step-copy">
                  <h3>{step.title}</h3>
                  <p>{step.description}</p>
                </div>
                {step.number !== '03' && <span className="step-connector" aria-hidden="true" />}
              </article>
            ))}
          </div>
        </section>

        <section className="closing-banner" aria-label="CampusFind invitation">
          <span className="closing-spark" aria-hidden="true">✳</span>
          <p>Every found item has a story.</p>
          <h2>Let&apos;s help it find its way home.</h2>
          <a
            className="button button-light button-large"
            href="/report"
            onClick={(event) => navigateTo(event, '/report')}
          >
            Report an Item
            <Icon name="arrow" />
          </a>
        </section>
          </>
        )}
      </main>

      <footer className="site-footer">
        <a
          className="brand footer-brand"
          href="/"
          aria-label="CampusFind home"
          onClick={(event) => navigateTo(event, '/')}
        >
          <span className="brand-mark"><Icon name="logo" /></span>
          <span className="brand-copy">
            <span className="brand-name">CampusFind</span>
            <span className="brand-tagline">Lost Today. Found Together.</span>
          </span>
        </a>
        <p className="footer-note">
          A student project made to bring our campus community a little closer.
        </p>
        <a
          className="footer-top-link"
          href={isBrowsePage ? '/browse' : isStaffPage ? '/staff' : '#home'}
          onClick={
            isBrowsePage
              ? (event) => navigateTo(event, '/browse')
              : isStaffPage
                ? (event) => navigateTo(event, '/staff')
                : undefined
          }
        >
          Back to top ↑
        </a>
        <p className="footer-copyright">© 2026 CampusFind · Homepage demo</p>
      </footer>
    </div>
  )
}

export default App
