import { listingImage } from '../services/bookings.js'

const placeholder = '/listing-images/placeholder.png'

function ListingImage({ listingId, alt, ...imageProps }) {
  function handleError(event) {
    const image = event.currentTarget
    if (image.getAttribute('src') !== placeholder) image.src = placeholder
  }

  return <img {...imageProps} src={listingImage(listingId)} alt={alt} onError={handleError} />
}

export default ListingImage
