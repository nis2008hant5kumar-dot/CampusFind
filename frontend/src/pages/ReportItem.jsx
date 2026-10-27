import { useEffect, useRef, useState } from 'react'
import { apiBaseUrl } from '../config/api.js'
import { itemCategories } from '../data/mockItems.js'
import './ReportItem.css'

const initialValues = {
  type: 'Lost',
  name: '',
  category: '',
  customCategory: '',
  description: '',
  date: '',
  location: '',
}

const maxPhotoSize = 5 * 1024 * 1024
const supportedImageTypes = ['image/jpeg', 'image/png', 'image/webp']
const currentDate = new Date()
const today = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`

function ReportItem({ onCancel }) {
  const [values, setValues] = useState(initialValues)
  const [photo, setPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoError, setPhotoError] = useState('')
  const [errors, setErrors] = useState({})
  const [confirmation, setConfirmation] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const formRef = useRef(null)
  const submissionInProgressRef = useRef(false)

  useEffect(() => {
    if (!photoPreview) return undefined
    return () => URL.revokeObjectURL(photoPreview)
  }, [photoPreview])

  const updateValue = (event) => {
    const { name, value } = event.target
    setValues((current) => {
      const next = { ...current, [name]: value }
      if (name === 'category' && value !== 'Other') {
        next.customCategory = ''
      }
      return next
    })
    setConfirmation(null)
    setSubmitError('')
    if (errors[name]) {
      setErrors((current) => ({ ...current, [name]: '' }))
    }
    if (name === 'category' && value !== 'Other' && errors.customCategory) {
      setErrors((current) => ({ ...current, customCategory: '' }))
    }
  }

  const selectPhoto = (event) => {
    const selected = event.target.files?.[0] || null
    event.target.value = ''
    setPhotoError('')
    setConfirmation(null)
    setSubmitError('')

    if (!selected) return
    if (!supportedImageTypes.includes(selected.type)) {
      setPhoto(null)
      setPhotoPreview('')
      setPhotoError('Choose a JPG, PNG or WebP image.')
      return
    }
    if (selected.size > maxPhotoSize) {
      setPhoto(null)
      setPhotoPreview('')
      setPhotoError('The image must be 5 MB or smaller.')
      return
    }
    setPhoto(selected)
    setPhotoPreview(URL.createObjectURL(selected))
  }

  const removePhoto = () => {
    setPhoto(null)
    setPhotoPreview('')
    setPhotoError('')
    setConfirmation(null)
    setSubmitError('')
  }

  const validate = () => {
    const nextErrors = {}
    if (!values.name.trim()) nextErrors.name = 'Enter an item name.'
    if (!values.category) {
      nextErrors.category = 'Choose a category.'
    } else if (values.category === 'Other') {
      if (!values.customCategory || !values.customCategory.trim()) {
        nextErrors.customCategory = 'Please specify a category.'
      } else if (values.customCategory.trim().length > 50) {
        nextErrors.customCategory = 'Specified category must be 50 characters or fewer.'
      }
    }
    if (!values.description.trim()) {
      nextErrors.description = 'Add a short description.'
    }
    if (!values.date) {
      nextErrors.date = 'Choose the date the item was lost or found.'
    } else if (values.date > today) {
      nextErrors.date = 'The date cannot be in the future.'
    }
    if (!values.location.trim()) {
      nextErrors.location = 'Enter an approximate campus location.'
    }
    return nextErrors
  }

  const submitReport = async (event) => {
    event.preventDefault()
    if (submissionInProgressRef.current || confirmation) return

    setAttemptedSubmit(true)
    const nextErrors = validate()
    setErrors(nextErrors)
    setConfirmation(null)
    setSubmitError('')

    if (Object.keys(nextErrors).length > 0 || photoError) {
      const firstInvalidField = ['name', 'category', 'customCategory', 'description', 'date', 'location']
        .find((field) => nextErrors[field])
      const invalidField = firstInvalidField
        ? formRef.current?.querySelector(`[name="${firstInvalidField}"]`)
        : formRef.current?.querySelector('#report-photo')
      invalidField?.focus()
      return
    }

    submissionInProgressRef.current = true
    setIsSubmitting(true)

    try {
      const response = await fetch(`${apiBaseUrl}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: values.type,
          name: values.name.trim(),
          category: values.category,
          description: values.description.trim(),
          date: values.date,
          location: values.location.trim(),
          ...(values.category === 'Other' && values.customCategory.trim()
            ? { customCategory: values.customCategory.trim() }
            : {}),
        }),
      })
      let payload
      try {
        payload = await response.json()
      } catch {
        throw new Error('The CampusFind API returned an unreadable response.')
      }

      if (!response.ok) {
        if (payload?.error?.details && typeof payload.error.details === 'object') {
          const serverErrors = Object.fromEntries(
            Object.entries(payload.error.details).filter(([field]) =>
              ['type', 'name', 'category', 'customCategory', 'description', 'date', 'location'].includes(field),
            ),
          )
          setErrors(serverErrors)
          const firstInvalidField = ['name', 'category', 'customCategory', 'description', 'date', 'location']
            .find((field) => serverErrors[field])
          formRef.current
            ?.querySelector(`[name="${firstInvalidField || 'name'}"]`)
            ?.focus()
        }
        throw new Error(
          payload?.error?.message ||
            `The report could not be created (HTTP ${response.status}).`,
        )
      }
      if (payload?.status !== 'ok' || !payload.item?.id) {
        throw new Error('The CampusFind API response did not confirm report creation.')
      }

      setConfirmation(payload.item)
    } catch (requestError) {
      setSubmitError(
        requestError instanceof TypeError
          ? 'Unable to reach the CampusFind API. Check that the backend is running, then try again.'
          : requestError.message,
      )
    } finally {
      submissionInProgressRef.current = false
      setIsSubmitting(false)
    }
  }

  const changeType = (event) => {
    updateValue(event)
    setErrors({})
    setAttemptedSubmit(false)
  }

  return (
    <div className="report-page">
      <section className="report-heading" aria-labelledby="report-title">
        <p className="browse-eyebrow">Campus Lost &amp; Found</p>
        <h1 id="report-title">Report an item</h1>
        <p>
          Share a few details to prepare a lost or found item report for this
          CampusFind demo.
        </p>
      </section>

      <div className="report-layout">
        <form
          className="report-form"
          ref={formRef}
          noValidate
          onSubmit={submitReport}
        >
          <fieldset className="report-type-fieldset">
            <legend>What would you like to report?</legend>
            <div className="report-type-options">
              {[
                { value: 'Lost', title: 'I Lost an Item', detail: 'I am looking for something I misplaced.' },
                { value: 'Found', title: 'I Found an Item', detail: 'I would like to help return something.' },
              ].map((option) => (
                <label
                  className={`report-type-option${values.type === option.value ? ' is-selected' : ''}`}
                  key={option.value}
                >
                  <input
                    type="radio"
                    name="type"
                    value={option.value}
                    checked={values.type === option.value}
                    onChange={changeType}
                  />
                  <span className="report-type-indicator" aria-hidden="true" />
                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.detail}</small>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="report-fields-grid">
            <div className="report-field">
              <label htmlFor="report-name">Item name <span aria-hidden="true">*</span></label>
              <input
                id="report-name"
                name="name"
                type="text"
                value={values.name}
                onChange={updateValue}
                placeholder="e.g. Black water bottle"
                maxLength={100}
                required
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? 'report-name-error' : undefined}
              />
              {errors.name && <p className="field-error" id="report-name-error">{errors.name}</p>}
            </div>

            <div className="report-field">
              <label htmlFor="report-category">Category <span aria-hidden="true">*</span></label>
              <select
                id="report-category"
                name="category"
                value={values.category}
                onChange={updateValue}
                required
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? 'report-category-error' : undefined}
              >
                <option value="">Select a category</option>
                {itemCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              {errors.category && (
                <p className="field-error" id="report-category-error">{errors.category}</p>
              )}
            </div>

            {values.category === 'Other' && (
              <div className="report-field report-field-full">
                <label htmlFor="report-custom-category">
                  Specify category <span aria-hidden="true">*</span>
                </label>
                <input
                  id="report-custom-category"
                  name="customCategory"
                  type="text"
                  value={values.customCategory}
                  onChange={updateValue}
                  placeholder="e.g. Sports Equipment"
                  maxLength={50}
                  required
                  aria-invalid={Boolean(errors.customCategory)}
                  aria-describedby={[
                    'report-custom-category-hint',
                    errors.customCategory ? 'report-custom-category-error' : '',
                  ].filter(Boolean).join(' ') || undefined}
                />
                <p className="field-hint" id="report-custom-category-hint">
                  Provide a brief, descriptive category for items not covered above.
                </p>
                {errors.customCategory && (
                  <p className="field-error" id="report-custom-category-error">
                    {errors.customCategory}
                  </p>
                )}
              </div>
            )}

            <div className="report-field report-field-full">
              <label htmlFor="report-description">Description <span aria-hidden="true">*</span></label>
              <textarea
                id="report-description"
                name="description"
                value={values.description}
                onChange={updateValue}
                placeholder="Describe the item, including useful identifying features."
                rows={4}
                maxLength={700}
                required
                aria-invalid={Boolean(errors.description)}
                aria-describedby={[
                  'report-description-hint',
                  errors.description ? 'report-description-error' : '',
                ].filter(Boolean).join(' ')}
              />
              <p className="field-hint" id="report-description-hint">
                Keep the location general. Don&apos;t include personal or sensitive information.
              </p>
              {values.type === 'Found' && (
                <p className="privacy-reminder">
                  For found items, don&apos;t reveal private ownership-verification
                  details in the public description.
                </p>
              )}
              {errors.description && (
                <p className="field-error" id="report-description-error">{errors.description}</p>
              )}
            </div>

            <div className="report-field">
              <label htmlFor="report-date">
                Date {values.type === 'Lost' ? 'lost' : 'found'} <span aria-hidden="true">*</span>
              </label>
              <input
                id="report-date"
                name="date"
                type="date"
                max={today}
                value={values.date}
                onChange={updateValue}
                required
                aria-invalid={Boolean(errors.date)}
                aria-describedby={errors.date ? 'report-date-error' : undefined}
              />
              {errors.date && <p className="field-error" id="report-date-error">{errors.date}</p>}
            </div>

            <div className="report-field">
              <label htmlFor="report-location">Approximate campus location <span aria-hidden="true">*</span></label>
              <input
                id="report-location"
                name="location"
                type="text"
                value={values.location}
                onChange={updateValue}
                placeholder="e.g. Near the main library"
                maxLength={120}
                required
                aria-invalid={Boolean(errors.location)}
                aria-describedby={errors.location ? 'report-location-error' : 'report-location-hint'}
              />
              <p className="field-hint" id="report-location-hint">
                Use a general area, not an exact recovery location.
              </p>
              {errors.location && (
                <p className="field-error" id="report-location-error">{errors.location}</p>
              )}
            </div>

            <div className="report-field report-field-full">
              <label htmlFor="report-photo">Item photo <span className="optional-label">(optional)</span></label>
              <div className="photo-upload-control">
                <input
                  id="report-photo"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={selectPhoto}
                  aria-describedby={`report-photo-hint${photoError ? ' report-photo-error' : ''}`}
                  aria-invalid={Boolean(photoError)}
                />
                <p className="field-hint" id="report-photo-hint">
                  JPG, PNG or WebP, up to 5 MB. The image stays in this browser
                  and is not uploaded.
                </p>
              </div>
              {photoError && (
                <p className="field-error" id="report-photo-error" role="alert">
                  {photoError}
                </p>
              )}
              {photo && (
                <div className="photo-preview">
                  <img src={photoPreview} alt={`Preview of selected item: ${photo.name}`} />
                  <div className="photo-preview-info">
                    <strong>{photo.name}</strong>
                    <span>{(photo.size / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                  <button type="button" className="photo-remove" onClick={removePhoto}>
                    Remove photo
                  </button>
                </div>
              )}
            </div>
          </div>

          {attemptedSubmit && (Object.keys(errors).length > 0 || photoError) && (
            <p className="form-error-summary" role="alert">
              Please correct the highlighted fields before continuing.
            </p>
          )}

          {submitError && (
            <p className="form-error-summary" role="alert" aria-live="assertive">
              {submitError}
            </p>
          )}

          {confirmation && (
            <div className="report-confirmation" role="status" aria-live="polite">
              <strong>Demo report created</strong>
              <p>
                Reference {confirmation.id}: your {confirmation.status.toLowerCase()}
                {' '}item is available in Browse Items while the backend process
                remains running. This is in-memory demo data and will reset
                when the server restarts. The selected photo was not uploaded.
              </p>
            </div>
          )}

          <div className="report-actions">
            <button
              className="button button-dark"
              type="submit"
              disabled={isSubmitting || Boolean(confirmation)}
            >
              {isSubmitting
                ? 'Creating demo report…'
                : confirmation
                  ? 'Demo report created'
                  : 'Submit demo report'}
            </button>
            <button className="button button-outline" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </form>

        <aside className="report-side-note" aria-label="Privacy information">
          <span className="report-side-icon" aria-hidden="true">i</span>
          <h2>Share thoughtfully</h2>
          <p>
            Only include details that help identify the item. Keep personal
            information and precise recovery locations private.
          </p>
          <div className="report-demo-callout">
            <strong>Demo only</strong>
            <span>
              Reports are held in backend memory and reset when the server
              restarts. Photos stay in this browser and are not uploaded.
            </span>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default ReportItem
