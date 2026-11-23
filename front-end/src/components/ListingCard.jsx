import { Link } from 'react-router-dom'
import ListingImage from './ListingImage.jsx'
import { CURRENT_USER_ID } from '../services/mockDataService.js'
import SaveListingButton from './SaveListingButton.jsx'

function ListingCard({ listing }) {
  return (
    <article className="ds-listing-card">
      <div className="ds-listing-media">
        <ListingImage
          listingId={listing.id}
          alt={listing.title}
          width={240}
          height={240}
          loading="lazy"
        />
      </div>
      <div className="ds-listing-content">
        <p className="ds-listing-category">{listing.category}</p>
        <h2>
          <Link to={`/browse/${listing.id}`}>
            {listing.title}
          </Link>
        </h2>
        <p className="ds-listing-description">{listing.description}</p>
        <div className="ds-listing-footer">
          <p className="ds-listing-price">${listing.price.toFixed(2)} <span>/ day</span></p>
          {listing.ownerId !== CURRENT_USER_ID && (
            <SaveListingButton listing={listing} />
          )}
        </div>
      </div>
    </article>
  )
}

export default ListingCard
