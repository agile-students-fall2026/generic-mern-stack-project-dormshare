import { useState } from 'react'

const startingListings = [
  { id: 1, title: 'Mini fridge', price: 15, status: 'Published' },
  { id: 2, title: 'Desk lamp', price: 5, status: 'Paused' },
  { id: 3, title: 'Study chair', price: 10, status: 'Draft' },
]

function App() {
  const [listings] = useState(startingListings)
  return (
    <main>
      <header className="page-header">
        <div>
          <h1>DormShare</h1>
          <p>Manage the items you lend to other students.</p>
        </div>
      </header>
            <section>
        <h2>My listings</h2>
        <div className="listing-grid">
          {listings.map((listing) => (
            <article className="listing-card" key={listing.id}>
              <div>
                <h3>{listing.title}</h3>
                <p>${listing.price.toFixed(2)} per day</p>
              </div>
              <span
                className={`status status-${listing.status.toLowerCase()}`}
              >
                {listing.status}
              </span>
            </article>
          ))}
        </div>
      </section>

    </main>
  )
}

export default App
