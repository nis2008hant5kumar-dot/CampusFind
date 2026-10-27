import { useEffect, useRef, useState } from 'react'
import { apiBaseUrl } from '../config/api.js'
import { itemCategories } from '../data/mockItems.js'
import './BrowseItems.css'

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.5 4.5" />
    </svg>
  )
}

function ItemIllustration({ type }) {
  const common = {
    'aria-hidden': true,
    viewBox: '0 0 48 48',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }

  switch (type) {
    case 'card':
      return (
        <svg {...common}>
          <rect x="8" y="12" width="32" height="24" rx="4" />
          <path d="M8 19h32M14 27h9M14 31h14" />
        </svg>
      )
    case 'wallet':
      return (
        <svg {...common}>
          <rect x="8" y="12" width="32" height="25" rx="4" />
          <path d="M8 19h32M31 27h.1M13 12V9h22v3" />
        </svg>
      )
    case 'keys':
      return (
        <svg {...common}>
          <circle cx="17" cy="20" r="7" />
          <path d="m22 25 13 13m-5-5 4-4m-8 0 4-4" />
          <circle cx="17" cy="20" r="2" />
        </svg>
      )
    case 'headphones':
      return (
        <svg {...common}>
          <path d="M9 26v-5a15 15 0 0 1 30 0v5" />
          <rect x="7" y="24" width="8" height="14" rx="3" />
          <rect x="33" y="24" width="8" height="14" rx="3" />
          <path d="M15 36a4 4 0 0 0 4 4h7" />
        </svg>
      )
    case 'bottle':
      return (
        <svg {...common}>
          <path d="M19 10h10v5l3 4v17a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V19l3-4v-5Z" />
          <path d="M19 15h10M17 28h14" />
        </svg>
      )
    case 'notebook':
      return (
        <svg {...common}>
          <rect x="13" y="8" width="25" height="32" rx="3" />
          <path d="M19 8v32M8 14h5M8 21h5M8 28h5M8 35h5M24 17h8M24 23h8" />
        </svg>
      )
    case 'charger':
      return (
        <svg {...common}>
          <rect x="12" y="14" width="21" height="19" rx="4" />
          <path d="M18 14V9m9 5V9M18 25h9M22 21l-3 4h4l-2 4" />
          <path d="M33 24h4a4 4 0 0 1 4 4v5" />
        </svg>
      )
    case 'bag':
      return (
        <svg {...common}>
          <path d="M12 18h24l3 21H9l3-21Z" />
          <path d="M18 18v-4a6 6 0 0 1 12 0v4M18 25v.1M30 25v.1" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <path d="M24 7v34M10 15l28 18M38 15 10 33" />
          <circle cx="24" cy="24" r="17" />
        </svg>
      )
  }
}

function ItemCard({ item, onSelect }) {
  const visualByCategory = {
    'Cards & Wallets': 'wallet',
    'Bags & Personal Items': 'bag',
    'Books & Stationery': 'notebook',
    Electronics: item.name.toLocaleLowerCase().includes('headphone')
      ? 'headphones'
      : 'charger',
    Keys: 'keys',
    Other: 'bottle',
  }
  const visual = item.visual || visualByCategory[item.category]
  const reportedDate = /^\d{4}-\d{2}-\d{2}$/.test(item.reported)
    ? new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${item.reported}T00:00:00Z`))
    : item.reported

  return (
    <button
      className="browse-item-card"
      type="button"
      onClick={() => onSelect(item)}
      aria-label={`View details for ${item.name}, ${item.status.toLowerCase()}, ${item.customCategory ? `Other (${item.customCategory})` : item.category}`}
    >
      <span className={`item-illustration item-illustration-${visual}`}>
        <ItemIllustration type={visual} />
      </span>
      <span className="item-card-body">
        <span className="item-card-topline">
          <span className={`item-status item-status-${item.status.toLowerCase()}`}>
            {item.status}
          </span>
          <span className="item-card-time">{reportedDate}</span>
        </span>
        <span className="item-card-name">{item.name}</span>
        <span className="item-card-category">{item.customCategory ? `Other (${item.customCategory})` : item.category}</span>
        <span className="item-card-description">{item.description}</span>
        <span className="item-card-location">
          <span aria-hidden="true">⌖</span>
          {item.location}
        </span>
      </span>
      <span className="item-card-open" aria-hidden="true">View details →</span>
    </button>
  )
}

function ItemDetailsDialog({ item, onClose }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (item && dialog && !dialog.open) {
      dialog.showModal()
    } else if (!item && dialog?.open) {
      dialog.close()
    }
  }, [item])

  return (
    <dialog
      className="item-details-dialog"
      ref={dialogRef}
      aria-labelledby="item-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {item && (
        <div className="item-dialog-content">
          <div className="item-dialog-heading">
            <div>
              <p className="browse-eyebrow">Illustrative demo detail</p>
              <h2 id="item-dialog-title">{item.name}</h2>
            </div>
            <button
              className="item-dialog-close"
              type="button"
              aria-label="Close item details"
              onClick={onClose}
              autoFocus
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>
          <div className="item-dialog-summary">
            <span className={`item-status item-status-${item.status.toLowerCase()}`}>
              {item.status}
            </span>
            <span className="item-card-category">{item.customCategory ? `Other (${item.customCategory})` : item.category}</span>
          </div>
          <p className="item-dialog-description">{item.description}</p>
          <dl className="item-dialog-meta">
            {item.customCategory && (
              <div>
                <dt>Specified category</dt>
                <dd>{item.customCategory}</dd>
              </div>
            )}
            <div>
              <dt>Approximate location</dt>
              <dd>{item.location}</dd>
            </div>
            <div>
              <dt>Reported</dt>
              <dd>{item.reported}</dd>
            </div>
          </dl>
          <p className="item-dialog-note">
            This is illustrative demo content. No real report or contact
            information is connected.
          </p>
        </div>
      )}
    </dialog>
  )
}

function BrowseItems() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('All')
  const [category, setCategory] = useState('All')
  const [items, setItems] = useState([])
  const [categoriesLoaded, setCategoriesLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [selectedItem, setSelectedItem] = useState(null)
  const availableCategoriesRef = useRef(null)

  useEffect(() => {
    let isCurrentRequest = true
    const controller = new AbortController()

    if (
      category !== 'All' &&
      availableCategoriesRef.current &&
      !availableCategoriesRef.current.includes(category)
    ) {
      setItems([])
      setError('')
      setLoading(false)
      return () => {
        isCurrentRequest = false
        controller.abort()
      }
    }

    const loadItems = async () => {
      setLoading(true)
      setError('')
      const query = new URLSearchParams()
      if (status !== 'All') query.set('status', status)
      if (category !== 'All') query.set('category', category)
      const queryString = query.toString()

      try {
        const response = await fetch(
          `${apiBaseUrl}/api/items${queryString ? `?${queryString}` : ''}`,
          { signal: controller.signal },
        )
        let payload
        try {
          payload = await response.json()
        } catch {
          throw new Error('The CampusFind API returned an unreadable response.')
        }

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ||
              `The CampusFind API returned an error (HTTP ${response.status}).`,
          )
        }
        if (payload?.status !== 'ok' || !Array.isArray(payload.items)) {
          throw new Error('The CampusFind API response did not contain a valid item list.')
        }

        if (isCurrentRequest) {
          setItems(payload.items)
          if (status === 'All' && category === 'All') {
            availableCategoriesRef.current = [
              ...new Set(payload.items.map((item) => item.category)),
            ]
            setCategoriesLoaded(true)
          }
        }
      } catch (requestError) {
        if (!isCurrentRequest || requestError.name === 'AbortError') return
        setItems([])
        setError(
          requestError instanceof TypeError
            ? 'Unable to reach the CampusFind API. Check that the backend is running, then try again.'
            : requestError.message,
        )
      } finally {
        if (isCurrentRequest) setLoading(false)
      }
    }

    loadItems()
    return () => {
      isCurrentRequest = false
      controller.abort()
    }
  }, [category, retryCount, status])

  const filteredItems = items.filter((item) => {
    const searchText = search.trim().toLocaleLowerCase()
    const searchableText =
      `${item.name} ${item.description} ${item.category} ${item.customCategory || ''} ${item.location}`.toLocaleLowerCase()

    return !searchText || searchableText.includes(searchText)
  })

  const clearFilters = () => {
    setSearch('')
    setStatus('All')
    setCategory('All')
  }

  return (
    <div className="browse-page">
      <section className="browse-heading" aria-labelledby="browse-title">
        <p className="browse-eyebrow">Campus Lost &amp; Found</p>
        <h1 id="browse-title">Find what you&apos;ve lost.</h1>
        <p className="browse-intro">
          Explore items reported by the campus community and help belongings
          find their way home.
        </p>
        <p className="browse-demo-note">
          <span aria-hidden="true">i</span>
          Illustrative demo listings — not live reports
        </p>
      </section>

      <section className="browse-controls" aria-label="Search and filter listings">
        <div className="browse-search">
          <label className="visually-hidden" htmlFor="item-search">
            Search by item name, description or location
          </label>
          <SearchIcon />
          <input
            id="item-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by item name, description or location..."
          />
          {search && (
            <button
              className="search-clear"
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch('')}
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>

        <div className="browse-filter-row">
          <div className="browse-filter">
            <label htmlFor="status-filter">Item status</label>
            <select
              id="status-filter"
              value={status}
              disabled={loading && !categoriesLoaded}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="All">All Items</option>
              <option value="Lost">Lost</option>
              <option value="Found">Found</option>
            </select>
          </div>
          <div className="browse-filter">
            <label htmlFor="category-filter">Category</label>
            <select
              id="category-filter"
              value={category}
              disabled={loading && !categoriesLoaded}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="All">All Categories</option>
              {itemCategories.map((itemCategory) => (
                <option key={itemCategory} value={itemCategory}>
                  {itemCategory}
                </option>
              ))}
            </select>
          </div>
          <button
            className="clear-filters"
            type="button"
            onClick={clearFilters}
            disabled={search === '' && status === 'All' && category === 'All'}
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="browse-results" aria-labelledby="results-heading">
        <div className="browse-results-heading">
          <h2 id="results-heading">Campus listings</h2>
          <p aria-live="polite">
            {loading
              ? 'Loading demo items…'
              : `Showing ${filteredItems.length} ${filteredItems.length === 1 ? 'demo item' : 'demo items'}`}
          </p>
        </div>

        {loading ? (
          <div className="browse-loading-state" role="status" aria-live="polite">
            <span className="browse-loading-indicator" aria-hidden="true" />
            <p>Loading demo listings…</p>
          </div>
        ) : error ? (
          <div className="browse-error-state" role="alert">
            <span className="browse-error-mark" aria-hidden="true">!</span>
            <h3>Listings couldn&apos;t be loaded</h3>
            <p>{error}</p>
            <button
              className="button button-dark"
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try again
            </button>
          </div>
        ) : filteredItems.length > 0 ? (
          <div className="browse-item-grid">
            {filteredItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onSelect={setSelectedItem}
              />
            ))}
          </div>
        ) : (
          <div className="browse-empty-state" role="status" aria-live="polite">
            <span className="empty-search-icon"><SearchIcon /></span>
            <h3>No matching items</h3>
            <p>
              Try a different search, or adjust your status and category
              filters.
            </p>
            <button
              className="button button-dark"
              type="button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <ItemDetailsDialog
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  )
}

export default BrowseItems
