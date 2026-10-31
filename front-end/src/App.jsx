import { useState } from 'react'
import {
  listingCategories,
  mockListings,
  mockRentals,
  rentalStatuses,
} from './mockData.js'

const emptyForm = {
  title: '',
  category: '',
  description: '',
  price: '',
  rentalTerms: '',
}

function formatStatus(status) {
  return status.replace(/_/g, ' ')
}

function App() {
  const [listings, setListings] = useState(mockListings)
  const [rentals] = useState(mockRentals)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [previewId, setPreviewId] = useState(null)
  const [listingSearch, setListingSearch] = useState('')
  const [listingStatus, setListingStatus] = useState('All')
  const [rentalSearch, setRentalSearch] = useState('')
  const [rentalStatus, setRentalStatus] = useState('All')

  const visibleListings = listings.filter((listing) => {
    const matchesStatus =
      listingStatus === 'All' || listing.status === listingStatus
    const searchText = `${listing.title} ${listing.category}`.toLowerCase()
    const matchesSearch = searchText.includes(listingSearch.trim().toLowerCase())

    return matchesStatus && matchesSearch
  })

  const visibleRentals = rentals.filter((rental) => {
    const listing = listings.find((item) => item.id === rental.listingId)
    const matchesStatus =
      rentalStatus === 'All' || rental.status === rentalStatus
    const searchText =
      `${listing?.title ?? ''} ${rental.borrowerId}`.toLowerCase()
    const matchesSearch = searchText.includes(rentalSearch.trim().toLowerCase())

    return matchesStatus && matchesSearch
  })

  const activeRentals = rentals.filter(
    (rental) => rental.status === 'active',
  ).length

  const recordedIncome = rentals
    .filter((rental) => rental.status === 'completed')
    .reduce((total, rental) => total + rental.totalPrice, 0)

  const previewListing = listings.find((listing) => listing.id === previewId)

  function startNewListing() {
    setEditingId(null)
    setForm(emptyForm)
    setPreviewId(null)
    setFormOpen(true)
  }

  function startEditing(listing) {
    setEditingId(listing.id)
    setForm({
      title: listing.title,
      category: listing.category,
      description: listing.description,
      price: String(listing.price),
      rentalTerms: listing.rentalTerms,
    })
    setPreviewId(null)
    setFormOpen(true)
  }

  function updateForm(event) {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  function saveListing(event) {
    event.preventDefault()

    const details = {
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      price: Number(form.price),
      rentalTerms: form.rentalTerms.trim(),
    }

    if (
      !details.title ||
      !details.category ||
      !details.description ||
      !details.rentalTerms ||
      !Number.isFinite(details.price) ||
      details.price < 0
    ) {
      return
    }

    let savedListing

    if (editingId === null) {
      savedListing = {
        id: Date.now(),
        ownerId: 'owner-1',
        ...details,
        status: 'Draft',
      }
      setListings((current) => [savedListing, ...current])
    } else {
      const existingListing = listings.find(
        (listing) => listing.id === editingId,
      )

      if (!existingListing) return

      savedListing = { ...existingListing, ...details }
      setListings((current) =>
        current.map((listing) =>
          listing.id === editingId ? savedListing : listing,
        ),
      )
    }

    setFormOpen(false)
    setEditingId(null)
    setForm(emptyForm)
    setPreviewId(savedListing.id)
  }

  function publishListing(id) {
    setListings((current) =>
      current.map((listing) =>
        listing.id === id ? { ...listing, status: 'Published' } : listing,
      ),
    )
    setPreviewId(null)
  }

  function toggleListingStatus(id) {
    setListings((current) =>
      current.map((listing) => {
        if (listing.id !== id) return listing

        return {
          ...listing,
          status: listing.status === 'Published' ? 'Paused' : 'Published',
        }
      }),
    )
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>DormShare</h1>
          <p>Manage your listings and rentals.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={startNewListing}
        >
          Add listing
        </button>
      </header>

      <section className="summary">
        <article>
          <span>Total rentals</span>
          <strong>{rentals.length}</strong>
        </article>
        <article>
          <span>Active rentals</span>
          <strong>{activeRentals}</strong>
        </article>
        <article>
          <span>Recorded income</span>
          <strong>${recordedIncome.toFixed(2)}</strong>
        </article>
      </section>

      {formOpen && (
        <form className="listing-form" onSubmit={saveListing}>
          <h2>{editingId === null ? 'New listing' : 'Edit listing'}</h2>

          <label>
            Item name
            <input
              name="title"
              required
              value={form.title}
              onChange={updateForm}
            />
          </label>

          <label>
            Category
            <select
              name="category"
              required
              value={form.category}
              onChange={updateForm}
            >
              <option value="">Choose a category</option>
              {listingCategories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>

          <label>
            Description
            <textarea
              name="description"
              required
              rows="3"
              value={form.description}
              onChange={updateForm}
            />
          </label>

          <label>
            Price per day
            <input
              name="price"
              required
              min="0"
              step="0.01"
              type="number"
              value={form.price}
              onChange={updateForm}
            />
          </label>

          <label>
            Rental terms
            <textarea
              name="rentalTerms"
              required
              rows="3"
              value={form.rentalTerms}
              onChange={updateForm}
            />
          </label>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Save and preview
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false)
                setEditingId(null)
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {previewListing && (
        <section className="preview-card">
          <h2>Listing preview</h2>
          <p>{previewListing.category}</p>
          <h3>{previewListing.title}</h3>
          <p>{previewListing.description}</p>
          <p>${previewListing.price.toFixed(2)} per day</p>
          <p>
            <strong>Rental terms:</strong> {previewListing.rentalTerms}
          </p>
          <div className="form-actions">
            <button
              type="button"
              onClick={() => startEditing(previewListing)}
            >
              Edit
            </button>
            <button
              className="primary-button"
              type="button"
              onClick={() => publishListing(previewListing.id)}
            >
              Publish listing
            </button>
            <button type="button" onClick={() => setPreviewId(null)}>
              Close preview
            </button>
          </div>
        </section>
      )}

      <section className="listings-section">
        <h2>My listings</h2>

        <div className="filters">
          <input
            aria-label="Search listings"
            placeholder="Search listings"
            value={listingSearch}
            onChange={(event) => setListingSearch(event.target.value)}
          />
          <select
            aria-label="Filter listings by status"
            value={listingStatus}
            onChange={(event) => setListingStatus(event.target.value)}
          >
            <option>All</option>
            <option>Draft</option>
            <option>Published</option>
            <option>Paused</option>
          </select>
        </div>

        {visibleListings.length === 0 ? (
          <p>
            {listings.length === 0
              ? 'No listings yet. Add one to get started.'
              : 'No listings match your search.'}
          </p>
        ) : (
          <div className="listing-grid">
            {visibleListings.map((listing) => (
              <article className="listing-card" key={listing.id}>
                <div>
                  <h3>{listing.title}</h3>
                  <p>{listing.category}</p>
                  <p>${listing.price.toFixed(2)} per day</p>
                  <span
                    className={`status status-${listing.status.toLowerCase()}`}
                  >
                    {listing.status}
                  </span>
                </div>

                <div className="listing-actions">
                  <button type="button" onClick={() => startEditing(listing)}>
                    Edit
                  </button>
                  {listing.status === 'Draft' ? (
                    <button
                      type="button"
                      onClick={() => setPreviewId(listing.id)}
                    >
                      Preview
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleListingStatus(listing.id)}
                    >
                      {listing.status === 'Published' ? 'Pause' : 'Publish'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rentals-section">
        <h2>Rental activity</h2>

        <div className="filters">
          <input
            aria-label="Search rentals"
            placeholder="Search by item or borrower"
            value={rentalSearch}
            onChange={(event) => setRentalSearch(event.target.value)}
          />
          <select
            aria-label="Filter rentals by status"
            value={rentalStatus}
            onChange={(event) => setRentalStatus(event.target.value)}
          >
            <option>All</option>
            {rentalStatuses.map((status) => (
              <option key={status} value={status}>
                {formatStatus(status)}
              </option>
            ))}
          </select>
        </div>

        {visibleRentals.length === 0 ? (
          <p>No rentals match your search.</p>
        ) : (
          <div className="rental-grid">
            {visibleRentals.map((rental) => {
              const listing = listings.find(
                (item) => item.id === rental.listingId,
              )

              return (
                <article className="rental-card" key={rental.id}>
                  <div>
                    <h3>{listing?.title ?? 'Listing unavailable'}</h3>
                    <p>Borrower: {rental.borrowerId}</p>
                    <p>
                      {rental.startDate} to {rental.endDate}
                    </p>
                    <p>Total: ${rental.totalPrice.toFixed(2)}</p>
                  </div>
                  <span className="rental-status">
                    {formatStatus(rental.status)}
                  </span>
                </article>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}

export default App