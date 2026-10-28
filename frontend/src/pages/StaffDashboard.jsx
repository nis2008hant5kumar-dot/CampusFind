import { useEffect, useMemo, useRef, useState } from 'react'
import { apiBaseUrl } from '../config/api.js'
import './StaffDashboard.css'

const reviewStatuses = ['Pending review', 'Approved', 'Dismissed']

function formatDateTime(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat('en', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(value))
  } catch {
    return value
  }
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function getActionError(error, fallback) {
  if (error instanceof TypeError) {
    return 'Unable to reach the CampusFind API. The staff action was not completed.'
  }
  return error.message || fallback
}

function ReportDetailsDialog({
  report,
  isSubmitting,
  actionError,
  onClose,
  onApprove,
  onDismiss,
  onWarn,
}) {
  const dialogRef = useRef(null)
  const [activeMode, setActiveMode] = useState('view') // 'view' | 'dismiss' | 'warn'
  const [dismissReason, setDismissReason] = useState('Investigation found no issue')
  const [warnReason, setWarnReason] = useState(
    'Inappropriate report: content violates campus reporting guidelines',
  )

  useEffect(() => {
    const dialog = dialogRef.current
    if (report && dialog && !dialog.open) {
      setActiveMode('view')
      setDismissReason('Investigation found no issue')
      setWarnReason('Inappropriate report: content violates campus reporting guidelines')
      dialog.showModal()
    } else if (!report && dialog?.open) {
      dialog.close()
    }
  }, [report])

  const submitDismissal = (e) => {
    e.preventDefault()
    if (!report || isSubmitting) return
    onDismiss(report, dismissReason)
  }

  const submitWarning = (e) => {
    e.preventDefault()
    if (!report || isSubmitting) return
    onWarn(report, warnReason)
  }

  return (
    <dialog
      className="staff-details-dialog"
      ref={dialogRef}
      aria-labelledby="staff-dialog-title"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {report && (
        <div className="staff-dialog-content">
          <div className="staff-dialog-heading">
            <div>
              <p className="staff-eyebrow">Report · {report.id}</p>
              <h2 id="staff-dialog-title">{report.itemName}</h2>
            </div>
            <button
              className="staff-dialog-close"
              type="button"
              aria-label="Close report details"
              onClick={onClose}
              autoFocus
            >
              <span aria-hidden="true">×</span>
            </button>
          </div>

          <div className="staff-dialog-badges">
            <span className={`staff-type-badge staff-type-${report.type.toLowerCase()}`}>
              {report.type}
            </span>
            <span className={`review-badge review-${report.reviewStatus.toLowerCase().replace(' ', '-')}`}>
              {report.reviewStatus}
            </span>
            {report.warningIssued && (
              <span className="staff-warning-badge" title={report.warningReason}>
                ⚠️ Reporter warned
              </span>
            )}
          </div>

          <p className="staff-dialog-description">{report.description}</p>

          <dl className="staff-detail-list">
            <div><dt>Category</dt><dd>{report.category}</dd></div>
            <div><dt>Approximate campus area</dt><dd>{report.location}</dd></div>
            <div><dt>Date reported</dt><dd>{formatDate(report.dateReported)}</dd></div>
            <div><dt>Report reference</dt><dd>{report.id}</dd></div>
          </dl>

          {/* Action-related notices & history */}
          {report.warningIssued && (
            <div className="staff-dialog-warning-banner" role="status" aria-live="polite">
              <span className="banner-icon" aria-hidden="true">⚠️</span>
              <div>
                <strong>Reporter Warning Issued</strong>
                <p>{report.warningReason}</p>
                {report.warnedAt && (
                  <small>Issued: {formatDateTime(report.warnedAt)}</small>
                )}
              </div>
            </div>
          )}

          {report.reviewStatus === 'Dismissed' && (
            <div className="staff-dialog-dismiss-banner" role="status" aria-live="polite">
              <span className="banner-icon" aria-hidden="true">✓</span>
              <div>
                <strong>Report Dismissed</strong>
                <p>{report.dismissReason || 'Investigation found no issue'}</p>
                {report.dismissedAt && (
                  <small>Resolved: {formatDateTime(report.dismissedAt)}</small>
                )}
              </div>
            </div>
          )}

          {actionError && (
            <div className="staff-action-error" role="alert">
              <span>{actionError}</span>
            </div>
          )}

          {/* Interactive Action Forms or Buttons */}
          {activeMode === 'dismiss' ? (
            <form className="staff-action-box" onSubmit={submitDismissal}>
              <h3 className="staff-action-box-title">Dismiss report (Investigation finds no issue)</h3>
              <p className="staff-action-box-desc">
                Dismissing this report records that staff investigated the submission and found no issue.
                The report status will update to <strong>Dismissed</strong>.
              </p>
              <div className="staff-action-field">
                <label htmlFor="dismiss-reason-input">Resolution note / reason</label>
                <input
                  id="dismiss-reason-input"
                  className="staff-action-text-input"
                  type="text"
                  maxLength={500}
                  value={dismissReason}
                  onChange={(e) => setDismissReason(e.target.value)}
                  placeholder="e.g. Investigation found no issue"
                  required
                />
              </div>
              <div className="staff-action-box-actions">
                <button
                  className="staff-action staff-action-dismiss-confirm"
                  type="submit"
                  disabled={isSubmitting || !dismissReason.trim()}
                >
                  {isSubmitting ? 'Dismissing…' : 'Confirm Dismissal'}
                </button>
                <button
                  className="staff-action staff-action-cancel"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setActiveMode('view')}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : activeMode === 'warn' ? (
            <form className="staff-action-box staff-action-box-warn" onSubmit={submitWarning}>
              <h3 className="staff-action-box-title">Warn reporter (Inappropriate report)</h3>
              <p className="staff-action-box-desc">
                Use this action when a submission contains inappropriate content, false information,
                or violates campus policies. A formal warning notice will be attached to this report.
              </p>
              <div className="staff-action-field">
                <label htmlFor="warn-reason-input">Warning explanation</label>
                <textarea
                  id="warn-reason-input"
                  className="staff-action-textarea"
                  rows={3}
                  maxLength={500}
                  value={warnReason}
                  onChange={(e) => setWarnReason(e.target.value)}
                  placeholder="Describe why this report is inappropriate..."
                  required
                />
              </div>
              <p className="staff-dialog-subnote">
                Demo notice: Warning record is logged in the system. No student email is dispatched in this demo.
              </p>
              <div className="staff-action-box-actions">
                <button
                  className="staff-action staff-action-warn-confirm"
                  type="submit"
                  disabled={isSubmitting || !warnReason.trim()}
                >
                  {isSubmitting ? 'Issuing warning…' : 'Issue Warning Notice'}
                </button>
                <button
                  className="staff-action staff-action-cancel"
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setActiveMode('view')}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="staff-dialog-actions" aria-label="Report review actions">
              {report.reviewStatus === 'Pending review' ? (
                <>
                  <p className="staff-actions-prompt">Staff actions for this report:</p>
                  <div className="staff-dialog-action-buttons">
                    <button
                      className="staff-action staff-action-approve"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => onApprove(report)}
                    >
                      {isSubmitting ? 'Approving…' : 'Approve'}
                    </button>
                    <button
                      className="staff-action staff-action-dismiss"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setActiveMode('dismiss')}
                    >
                      Dismiss (no issue)
                    </button>
                    <button
                      className="staff-action staff-action-warn"
                      type="button"
                      disabled={isSubmitting || report.warningIssued}
                      onClick={() => setActiveMode('warn')}
                    >
                      {report.warningIssued ? 'Reporter warned' : 'Warn reporter (inappropriate)'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="staff-dialog-action-buttons">
                  <p className="staff-reviewed-note">
                    This report has been reviewed ({report.reviewStatus.toLowerCase()}).
                  </p>
                  {!report.warningIssued && (
                    <button
                      className="staff-action staff-action-warn"
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setActiveMode('warn')}
                    >
                      Warn reporter (inappropriate)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="staff-dialog-note">
            Staff actions update in-memory demonstration records. No student notification is sent.
          </p>
        </div>
      )}
    </dialog>
  )
}

function StaffDashboard({ staffUser, csrfToken, onLogout }) {
  const [reports, setReports] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadCount, setReloadCount] = useState(0)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedReport, setSelectedReport] = useState(null)
  const [feedbackNotice, setFeedbackNotice] = useState(null)
  const [actionError, setActionError] = useState('')
  const [isSubmittingAction, setIsSubmittingAction] = useState(false)

  // Fetch reports from backend API on mount
  useEffect(() => {
    let active = true
    const fetchReports = async () => {
      setIsLoading(true)
      setLoadError('')
      try {
        const response = await fetch(`${apiBaseUrl}/api/reports`, {
          credentials: 'include',
        })
        if (response.status === 401) {
          onLogout('Your staff session has expired. Please sign in again.')
          return
        }
        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          throw new Error(payload?.error?.message || `Unable to load reports (HTTP ${response.status}).`)
        }
        const data = await response.json()
        if (data?.status !== 'ok' || !Array.isArray(data.reports)) {
          throw new Error('The CampusFind API returned an invalid report list.')
        }
        if (active) setReports(data.reports)
      } catch (error) {
        if (active) {
          setLoadError(
            error instanceof TypeError
              ? 'Unable to reach the CampusFind API. Check the backend connection and retry.'
              : error.message,
          )
        }
      } finally {
        if (active) setIsLoading(false)
      }
    }

    fetchReports()
    return () => {
      active = false
    }
  }, [onLogout, reloadCount])

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return reports.filter((report) => (
      (!query ||
        report.itemName.toLocaleLowerCase().includes(query) ||
        report.id.toLocaleLowerCase().includes(query) ||
        report.location.toLocaleLowerCase().includes(query)) &&
      (typeFilter === 'All' || report.type === typeFilter) &&
      (statusFilter === 'All' || report.reviewStatus === statusFilter)
    ))
  }, [reports, search, statusFilter, typeFilter])

  const counts = useMemo(() => {
    return reports.reduce(
      (summary, report) => {
        summary.total += 1
        if (report.reviewStatus === 'Pending review') summary.pending += 1
        if (report.reviewStatus === 'Approved') summary.approved += 1
        if (report.reviewStatus === 'Dismissed') summary.dismissed += 1
        if (report.warningIssued) summary.warned += 1
        return summary
      },
      { total: 0, pending: 0, approved: 0, dismissed: 0, warned: 0 },
    )
  }, [reports])

  const closeDetails = () => {
    setSelectedReport(null)
    setActionError('')
  }

  // Staff Action 1: Dismiss a report when investigation finds no issue
  const handleDismissReport = async (report, reason) => {
    setIsSubmittingAction(true)
    setActionError('')
    const trimmedReason = reason.trim() || 'Investigation found no issue'

    try {
      const response = await fetch(`${apiBaseUrl}/api/reports/${encodeURIComponent(report.id)}/dismiss`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ reason: trimmedReason }),
      })

      if (response.status === 401) {
        const msg = 'Your staff session has expired. Please sign in again.'
        setActionError(msg)
        onLogout(msg)
        return
      }

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Dismissal failed (HTTP ${response.status})`)
      }

      const updatedReport = payload.report
      if (payload.status !== 'ok' || !updatedReport?.id) {
        throw new Error('The CampusFind API did not confirm the dismissal.')
      }
      setReports((current) => current.map((r) => (r.id === report.id ? updatedReport : r)))
      setSelectedReport(updatedReport)
      setFeedbackNotice({
        type: 'success',
        title: 'Report Dismissed',
        message: `Report ${report.id} (${report.itemName}) has been dismissed: "${trimmedReason}".`,
      })
    } catch (err) {
      setActionError(getActionError(err, 'Dismissal request failed.'))
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Staff Action 2: Warn reporter when a report is inappropriate
  const handleWarnReporter = async (report, reason) => {
    setIsSubmittingAction(true)
    setActionError('')
    const trimmedReason =
      reason.trim() || 'Inappropriate report: content violates campus reporting guidelines'

    try {
      const response = await fetch(`${apiBaseUrl}/api/reports/${encodeURIComponent(report.id)}/warn`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
        body: JSON.stringify({ reason: trimmedReason }),
      })

      if (response.status === 401) {
        const msg = 'Your staff session has expired. Please sign in again.'
        setActionError(msg)
        onLogout(msg)
        return
      }

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Warning failed (HTTP ${response.status})`)
      }

      const updatedReport = payload.report
      if (payload.status !== 'ok' || !updatedReport?.id) {
        throw new Error('The CampusFind API did not confirm the warning.')
      }
      setReports((current) => current.map((r) => (r.id === report.id ? updatedReport : r)))
      setSelectedReport(updatedReport)
      setFeedbackNotice({
        type: 'warning',
        title: 'Reporter Warning Issued',
        message: `Warning issued to reporter for report ${report.id}: "${trimmedReason}".`,
      })
    } catch (err) {
      setActionError(getActionError(err, 'Warning request failed.'))
    } finally {
      setIsSubmittingAction(false)
    }
  }

  // Staff Action: Approve report
  const handleApproveReport = async (report) => {
    setIsSubmittingAction(true)
    setActionError('')

    try {
      const response = await fetch(`${apiBaseUrl}/api/reports/${encodeURIComponent(report.id)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken,
        },
        credentials: 'include',
      })

      if (response.status === 401) {
        const msg = 'Your staff session has expired. Please sign in again.'
        setActionError(msg)
        onLogout(msg)
        return
      }

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(payload?.error?.message || `Approval failed (HTTP ${response.status})`)
      }

      const updatedReport = payload.report
      if (payload.status !== 'ok' || !updatedReport?.id) {
        throw new Error('The CampusFind API did not confirm the approval.')
      }
      setReports((current) => current.map((r) => (r.id === report.id ? updatedReport : r)))
      setSelectedReport(updatedReport)
      setFeedbackNotice({
        type: 'success',
        title: 'Report Approved',
        message: `Report ${report.id} (${report.itemName}) has been approved and verified.`,
      })
    } catch (err) {
      setActionError(getActionError(err, 'Approval request failed.'))
    } finally {
      setIsSubmittingAction(false)
    }
  }

  const clearFilters = () => {
    setSearch('')
    setTypeFilter('All')
    setStatusFilter('All')
  }

  return (
    <div className="staff-page" id="staff-dashboard">
      <section className="staff-heading" aria-labelledby="staff-title">
        <div>
          <p className="staff-eyebrow">CampusFind · Staff tools</p>
          <h1 id="staff-title">Report review dashboard</h1>
          <p>
            Review campus lost-and-found reports, dismiss unneeded records, and issue warnings for inappropriate submissions.
          </p>
        </div>
        <span className="staff-demo-label">
          Signed in as {staffUser?.name || staffUser?.email || 'Campus staff'}
        </span>
      </section>

      <section className="staff-summary" aria-label="Report summary">
        <article className="staff-summary-card">
          <span className="summary-label">Total reports</span>
          <strong>{counts.total}</strong>
          <span className="summary-detail">Demo records</span>
        </article>
        <article className="staff-summary-card summary-pending">
          <span className="summary-label">Pending review</span>
          <strong>{counts.pending}</strong>
          <span className="summary-detail">Awaiting staff action</span>
        </article>
        <article className="staff-summary-card summary-approved">
          <span className="summary-label">Approved</span>
          <strong>{counts.approved}</strong>
          <span className="summary-detail">Verified campus reports</span>
        </article>
        <article className="staff-summary-card summary-dismissed">
          <span className="summary-label">Dismissed</span>
          <strong>{counts.dismissed}</strong>
          <span className="summary-detail">No issue found / closed</span>
        </article>
      </section>

      {/* Confirmation / Feedback notice */}
      {feedbackNotice && (
        <div
          className={`staff-notice staff-notice-${feedbackNotice.type || 'info'}`}
          role="status"
          aria-live="polite"
        >
          <div className="staff-notice-body">
            <strong>{feedbackNotice.title}</strong>
            <p>{feedbackNotice.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackNotice(null)}
            aria-label="Dismiss feedback message"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
      )}

      <section className="staff-reports-panel" aria-labelledby="reports-heading">
        <div className="staff-panel-heading">
          <div>
            <h2 id="reports-heading">Item reports</h2>
            <p>Search, review, dismiss records, or warn reporters when inappropriate.</p>
          </div>
          <span className="staff-result-count" aria-live="polite">
            {isLoading ? 'Loading reports…' : `${filteredReports.length} ${filteredReports.length === 1 ? 'report' : 'reports'}`}
          </span>
        </div>

        <div className="staff-controls">
          <div className="staff-search-control">
            <label htmlFor="staff-search">Search item, ID or location</label>
            <input
              id="staff-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. notebook, CF-2041, library"
            />
          </div>
          <div className="staff-filter-control">
            <label htmlFor="staff-type-filter">Report type</label>
            <select
              id="staff-type-filter"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="All">All types</option>
              <option value="Lost">Lost</option>
              <option value="Found">Found</option>
            </select>
          </div>
          <div className="staff-filter-control">
            <label htmlFor="staff-status-filter">Review status</label>
            <select
              id="staff-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="All">All statuses</option>
              {reviewStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
          <button
            className="staff-clear-filters"
            type="button"
            onClick={clearFilters}
            disabled={!search && typeFilter === 'All' && statusFilter === 'All'}
          >
            Clear filters
          </button>
        </div>

        {isLoading ? (
          <div className="staff-load-state" role="status" aria-live="polite">
            Loading staff reports…
          </div>
        ) : loadError ? (
          <div className="staff-load-error" role="alert">
            <h3>Reports could not be loaded</h3>
            <p>{loadError}</p>
            <button
              className="staff-view-button"
              type="button"
              onClick={() => setReloadCount((count) => count + 1)}
            >
              Retry
            </button>
          </div>
        ) : filteredReports.length > 0 ? (
          <div className="staff-table-wrap">
            <table className="staff-reports-table">
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Report</th>
                  <th scope="col">Category</th>
                  <th scope="col">Approximate location</th>
                  <th scope="col">Date reported</th>
                  <th scope="col">Review status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReports.map((report) => (
                  <tr key={report.id}>
                    <td data-label="Item">
                      <span className="staff-item-name">{report.itemName}</span>
                      <span className="staff-item-reference">{report.id}</span>
                    </td>
                    <td data-label="Report">
                      <span className={`staff-type-badge staff-type-${report.type.toLowerCase()}`}>
                        {report.type}
                      </span>
                    </td>
                    <td data-label="Category">{report.category}</td>
                    <td data-label="Approximate location">{report.location}</td>
                    <td data-label="Date reported">{formatDate(report.dateReported)}</td>
                    <td data-label="Review status">
                      <div className="staff-status-cell">
                        <span className={`review-badge review-${report.reviewStatus.toLowerCase().replace(' ', '-')}`}>
                          {report.reviewStatus}
                        </span>
                        {report.warningIssued && (
                          <span
                            className="staff-warning-state"
                            title={`Warning: ${report.warningReason}`}
                          >
                            ⚠️ Reporter warned
                          </span>
                        )}
                      </div>
                    </td>
                    <td data-label="Actions">
                      <button
                        className="staff-view-button"
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        aria-label={`View details and actions for ${report.itemName}, report ${report.id}`}
                      >
                        Review / Action
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="staff-empty-state" role="status">
            <span className="staff-empty-mark" aria-hidden="true">⌕</span>
            <h3>No reports match these filters</h3>
            <p>Try another item name or clear the selected report type and review status.</p>
            <button className="staff-view-button" type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </section>

      <p className="staff-data-note">
        Staff actions require an authenticated staff session. Report data and action history remain in backend memory and reset when the server restarts.
      </p>

      <ReportDetailsDialog
        report={selectedReport}
        isSubmitting={isSubmittingAction}
        actionError={actionError}
        onClose={closeDetails}
        onApprove={handleApproveReport}
        onDismiss={handleDismissReport}
        onWarn={handleWarnReporter}
      />
    </div>
  )
}

export default StaffDashboard
