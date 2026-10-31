import { useState } from 'react'

const startingListings = [
  { id: 1, title: 'Mini fridge', price: 15, status: 'Published' },
  { id: 2, title: 'Desk lamp', price: 5, status: 'Paused' },
  { id: 3, title: 'Study chair', price: 10, status: 'Draft' },
]

function App() {
  const [listings, setListings] = useState(startingListings)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ title: '', price: '' })
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')

  const visibleListings = listings.filter((listing) => {
    const matchesStatus =
      statusFilter === 'All' || listing.status === statusFilter
    const matchesSearch = listing.title
      .toLowerCase()
      .includes(search.trim().toLowerCase())

    return matchesStatus && matchesSearch
  })

  const publishedCount = listings.filter(
    (listing) => listing.status === 'Published',
  ).length
  const pausedCount = listings.filter(
    (listing) => listing.status === 'Paused',
  ).length

  function startNewListing() {
    setEditingId(null)
    setForm({ title: '', price: '' })
    setFormOpen(true)
  }

  function startEditing(listing) {
    setEditingId(listing.id)
    setForm({ title: listing.title, price: String(listing.price) })
    setFormOpen(true)
  }

  function saveListing(event) {
    event.preventDefault()

    const title = form.title.trim()
    const price = Number(form.price)

    if (!title || !Number.isFinite(price) || price < 0) return

    if (editingId === null) {
      setListings((current) => [
        { id: Date.now(), title, price, status: 'Draft' },
        ...current,
      ])
    } else {
      setListings((current) =>
        current.map((listing) =>
          listing.id === editingId ? { ...listing, title, price } : listing,
        ),
      )
    }

    setFormOpen(false)
    setEditingId(null)
    setForm({ title: '', price: '' })
  }

  function toggleStatus(id) {
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
          <p>Manage the items you lend to other students.</p>
        </div>
        <button className="primary-button" onClick={startNewListing}>
          Add listing
        </button>
      </header>
      <section className="summary">
        <article>
          <span>Total listings</span>
          <strong>{listings.length}</strong>
        </article>
        <article>
          <span>Published</span>
          <strong>{publishedCount}</strong>
        </article>
        <article>
          <span>Paused</span>
          <strong>{pausedCount}</strong>
        </article>
      </section>
      {formOpen && (
        <form className="listing-form" onSubmit={saveListing}>
          <h2>{editingId === null ? 'New listing' : 'Edit listing'}</h2>

          <label>
            Item name
            <input
              required
              value={form.title}
              onChange={(event) =>
                setForm({ ...form, title: event.target.value })
              }
            />
          </label>

          <label>
            Price per day
            <input
              required
              min="0"
              step="0.01"
              type="number"
              value={form.price}
              onChange={(event) =>
                setForm({ ...form, price: event.target.value })
              }
            />
          </label>

          <div className="form-actions">
            <button className="primary-button" type="submit">
              Save listing
            </button>
            <button type="button" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <section>
        <h2>My listings</h2>
        <div className="filters">
          <input
            aria-label="Search listings"
            placeholder="Search listings"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>All</option>
            <option>Published</option>
            <option>Paused</option>
            <option>Draft</option>
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
                  <p>${listing.price.toFixed(2)} per day</p>
                  <span
                    className={`status status-${listing.status.toLowerCase()}`}
                  >
                    {listing.status}
                  </span>
                </div>
                <div className="listing-actions">
                  <button onClick={() => startEditing(listing)}>Edit</button>
                  <button onClick={() => toggleStatus(listing.id)}>
                    {listing.status === 'Published' ? 'Pause' : 'Publish'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export default App