import { useEffect, useMemo, useRef, useState } from 'react'
import { mockStaffReports } from '../data/mockStaffReports.js'
import './StaffDashboard.css'

const reviewStatuses = ['Pending review', 'Approved', 'Dismissed']

function ReportDetailsDialog({ report, warned, onClose, onApprove, onDismiss, onWarn }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (report && dialog && !dialog.open) {
      dialog.showModal()
    } else if (!report && dialog?.open) {
      dialog.close()
    }
  }, [report])

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
              <p className="staff-eyebrow">Mock report · {report.id}</p>
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
          </div>
          <p className="staff-dialog-description">{report.description}</p>
          <dl className="staff-detail-list">
            <div><dt>Category</dt><dd>{report.category}</dd></div>
            <div><dt>Approximate campus area</dt><dd>{report.location}</dd></div>
            <div><dt>Date reported</dt><dd>{formatDate(report.dateReported)}</dd></div>
            <div><dt>Report reference</dt><dd>{report.id}</dd></div>
          </dl>
          <p className="staff-dialog-note">
            Fictional demonstration record. No student identity, contact details,
            or precise recovery location is included.
          </p>
          {report.reviewStatus === 'Pending review' ? (
            <div className="staff-dialog-actions" aria-label="Report review actions">
              {warned && (
                <p className="staff-warning-notice" role="status" aria-live="polite">
                  Demo correction notice prepared locally. No student was contacted.
                </p>
              )}
              <div className="staff-dialog-action-buttons">
                <button className="staff-action staff-action-approve" type="button" onClick={() => onApprove(report)}>
                  Approve
                </button>
                <button className="staff-action staff-action-dismiss" type="button" onClick={() => onDismiss(report)}>
                  Dismiss
                </button>
                <button
                  className="staff-action staff-action-warn"
                  type="button"
                  disabled={warned}
                  onClick={() => onWarn(report)}
                >
                  {warned ? 'Warning previewed' : 'Warn (demo)'}
                </button>
              </div>
            </div>
          ) : (
            <p className="staff-reviewed-note">
              This report has already been reviewed. Review actions are unavailable.
            </p>
          )}
        </div>
      )}
    </dialog>
  )
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`))
}

function StaffDashboard() {
  const [reports, setReports] = useState(mockStaffReports)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedReport, setSelectedReport] = useState(null)
  const [warnedReports, setWarnedReports] = useState(() => new Set())
  const [notice, setNotice] = useState('')

  const filteredReports = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    return reports.filter((report) => (
      (!query || report.itemName.toLocaleLowerCase().includes(query)) &&
      (typeFilter === 'All' || report.type === typeFilter) &&
      (statusFilter === 'All' || report.reviewStatus === statusFilter)
    ))
  }, [reports, search, statusFilter, typeFilter])

  const counts = reports.reduce((summary, report) => {
    summary.total += 1
    if (report.reviewStatus === 'Pending review') summary.pending += 1
    if (report.reviewStatus === 'Approved') summary.approved += 1
    if (report.reviewStatus === 'Dismissed') summary.dismissed += 1
    return summary
  }, { total: 0, pending: 0, approved: 0, dismissed: 0 })

  const closeDetails = () => setSelectedReport(null)

  const reviewReport = (report, nextStatus) => {
    if (report.reviewStatus !== 'Pending review') return
    const action = nextStatus === 'Approved' ? 'approve' : 'dismiss'
    const confirmation = window.confirm(
      `Confirm ${action} for "${report.itemName}" (${report.id})? This demo change only updates this page.`,
    )
    if (!confirmation) return

    setReports((current) => current.map((entry) => (
      entry.id === report.id && entry.reviewStatus === 'Pending review'
        ? { ...entry, reviewStatus: nextStatus }
        : entry
    )))
    setNotice(`Demo report ${report.id} marked ${nextStatus.toLowerCase()}. This change is not saved.`)
    closeDetails()
  }

  const previewWarning = (report) => {
    if (report.reviewStatus !== 'Pending review' || warnedReports.has(report.id)) return
    setWarnedReports((current) => new Set(current).add(report.id))
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
            Review campus lost-and-found reports and manage their demo review status.
          </p>
        </div>
        <span className="staff-demo-label">Demo dashboard · no staff authentication</span>
      </section>

      <section className="staff-summary" aria-label="Report summary">
        <article className="staff-summary-card">
          <span className="summary-label">Total reports</span>
          <strong>{counts.total}</strong>
          <span className="summary-detail">Fictional demo records</span>
        </article>
        <article className="staff-summary-card summary-pending">
          <span className="summary-label">Pending review</span>
          <strong>{counts.pending}</strong>
          <span className="summary-detail">Awaiting a demo decision</span>
        </article>
        <article className="staff-summary-card summary-approved">
          <span className="summary-label">Approved</span>
          <strong>{counts.approved}</strong>
          <span className="summary-detail">Marked approved in this session</span>
        </article>
        <article className="staff-summary-card summary-dismissed">
          <span className="summary-label">Dismissed</span>
          <strong>{counts.dismissed}</strong>
          <span className="summary-detail">Marked dismissed in this session</span>
        </article>
      </section>

      <section className="staff-reports-panel" aria-labelledby="reports-heading">
        <div className="staff-panel-heading">
          <div>
            <h2 id="reports-heading">Item reports</h2>
            <p>Search and filter the fictional reports available in this demo.</p>
          </div>
          <span className="staff-result-count" aria-live="polite">
            {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
          </span>
        </div>

        <div className="staff-controls">
          <div className="staff-search-control">
            <label htmlFor="staff-search">Search item name</label>
            <input
              id="staff-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="e.g. notebook"
            />
          </div>
          <div className="staff-filter-control">
            <label htmlFor="staff-type-filter">Report type</label>
            <select id="staff-type-filter" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="All">All types</option>
              <option value="Lost">Lost</option>
              <option value="Found">Found</option>
            </select>
          </div>
          <div className="staff-filter-control">
            <label htmlFor="staff-status-filter">Review status</label>
            <select id="staff-status-filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="All">All statuses</option>
              {reviewStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
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

        {notice && (
          <div className="staff-notice" role="status" aria-live="polite">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label="Dismiss dashboard message">
              <span aria-hidden="true">×</span>
            </button>
          </div>
        )}

        {filteredReports.length > 0 ? (
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
                      <span className={`staff-type-badge staff-type-${report.type.toLowerCase()}`}>{report.type}</span>
                    </td>
                    <td data-label="Category">{report.category}</td>
                    <td data-label="Approximate location">{report.location}</td>
                    <td data-label="Date reported">{formatDate(report.dateReported)}</td>
                    <td data-label="Review status">
                      <span className={`review-badge review-${report.reviewStatus.toLowerCase().replace(' ', '-')}`}>
                        {report.reviewStatus}
                      </span>
                      {warnedReports.has(report.id) && (
                        <span className="staff-warning-state">Warning previewed</span>
                      )}
                    </td>
                    <td data-label="Actions">
                      <button
                        className="staff-view-button"
                        type="button"
                        onClick={() => setSelectedReport(report)}
                        aria-label={`View details for ${report.itemName}, report ${report.id}`}
                      >
                        View details
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
        Dashboard actions update fictional data in this page only. No reports are
        loaded from or saved to a database.
      </p>

      <ReportDetailsDialog
        report={selectedReport}
        warned={selectedReport ? warnedReports.has(selectedReport.id) : false}
        onClose={closeDetails}
        onApprove={(report) => reviewReport(report, 'Approved')}
        onDismiss={(report) => reviewReport(report, 'Dismissed')}
        onWarn={previewWarning}
      />
    </div>
  )
}

export default StaffDashboard
