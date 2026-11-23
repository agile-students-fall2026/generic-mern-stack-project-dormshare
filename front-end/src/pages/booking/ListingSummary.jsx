import { formatMoney, getUser } from '../../services/bookings'
import ListingImage from '../../components/ListingImage.jsx'

// Small item header reused by the booking screens.
function ListingSummary({ listing, detail }) {
  const owner = getUser(listing.ownerId)
  return (
    <div className="booking-card booking-item">
      <ListingImage listingId={listing.id} alt={listing.title} />
      <div>
        <h2>{listing.title}</h2>
        <p>{detail ?? `${owner?.name} · ${formatMoney(listing.price)}/day`}</p>
      </div>
    </div>
  )
}

export default ListingSummary
