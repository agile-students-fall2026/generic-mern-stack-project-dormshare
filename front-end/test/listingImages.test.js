import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listingImage } from '../src/services/bookings.js'
import { cacheListing } from '../src/services/mockDataService.js'

const placeholder = '/listing-images/placeholder.png'

test('listing images use the supplied HTTPS source without changing its URL', () => {
  const image = 'https://images.example.test/lamp.jpg?width=400&signature=example'
  cacheListing({ id: 7001, image })
  assert.equal(listingImage(7001, 96), image)
  assert.equal(listingImage('7001'), image)
})

test('listing images support local listing assets', () => {
  cacheListing({ id: 7002, image: '/listing-images/lamp.png' })
  assert.equal(listingImage(7002), '/listing-images/lamp.png')
})

test('missing or unsupported listing image sources use the placeholder', () => {
  assert.equal(listingImage('missing-listing'), placeholder)
  for (const image of [
    undefined, null, '', '   ', 12, {}, 'not a URL',
    'http://images.example.test/lamp.png', 'javascript:alert(1)',
    'data:image/png;base64,example', '//images.example.test/lamp.png',
    'https://user:password@images.example.test/lamp.png',
    '/listing-images/../private.png', '/listing-images/%2e%2e/private.png',
    '/other-path/lamp.png',
  ]) {
    cacheListing({ id: 7003, image })
    assert.equal(listingImage(7003), placeholder)
  }
})
