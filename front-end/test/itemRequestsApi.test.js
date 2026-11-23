import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createApp } from '../../back-end/app.js'
import { startTestServer } from '../../back-end/test/helpers/server.js'
import {
  closeItemRequest, fetchItemRequest, getItemRequest, getLatestResponse, postItemRequest,
} from '../src/services/itemRequests.js'
import { loadMockData } from '../src/services/mockDataService.js'
import { mockResponse } from './fixtures.js'

// Runs the front-end item request service against the real Express routes. The current
// user is owner-1, who owns request 2 ("HDMI cable"); request 1 is from student-2.
describe('Item request API integration (#109)', () => {
  const nativeFetch = globalThis.fetch
  let data
  let app
  let server
  const stored = (id) => data.itemRequests.find((request) => request.id === id)
  const form = () => ({
    itemName: '  Rice cooker  ', neededBy: '2099-02-01', neededUntil: '2099-02-03',
    approximateArea: '  Library  ', targetPrice: '12', details: '  Small one is fine.  ',
  })

  before(async () => {
    app = createApp({ store: { load: async () => data } })
    server = await startTestServer(app)
    globalThis.fetch = (url, options) => nativeFetch(new URL(url, server.baseUrl), options)
    data = mockResponse()
    await loadMockData()
  })

  beforeEach(() => {
    data = mockResponse()
    app.locals.mockDataStore.load = async () => data
  })

  after(async () => {
    globalThis.fetch = nativeFetch
    await server?.close()
  })

  describe('posting a request', () => {
    it('saves it on the server and caches it for the board', async () => {
      const { request, errors } = await postItemRequest(form())
      assert.equal(errors, undefined)
      assert.equal(request.requesterId, 'owner-1')
      assert.equal(request.itemName, 'Rice cooker')
      assert.equal(request.targetPrice, 12)
      assert.deepEqual(stored(request.id), request)
      assert.deepEqual(getItemRequest(request.id), request)
    })

    it('sends an empty target price as no target', async () => {
      const { request } = await postItemRequest({ ...form(), targetPrice: '' })
      assert.equal(request.targetPrice, null)
    })

    it('returns form errors without contacting the server', async () => {
      const before = data.itemRequests.length
      const { errors } = await postItemRequest({ ...form(), itemName: '   ' })
      assert.deepEqual(errors, { itemName: 'Say what you need.' })
      assert.equal(data.itemRequests.length, before)
    })

    it('returns the server\'s field errors the same way', async () => {
      const { request, errors } = await postItemRequest({ ...form(), itemName: 'x'.repeat(101) })
      assert.equal(request, undefined)
      assert.deepEqual(errors, { itemName: 'Keep it under 100 characters.' })
    })
  })

  describe('loading a request', () => {
    it('loads a request posted on the server after the app loaded', async () => {
      data.itemRequests.push({ ...stored(1), id: 9, itemName: 'Kettle', createdAt: '2026-11-20T12:00:00Z' })
      assert.equal(getItemRequest(9), undefined)
      const request = await fetchItemRequest(9)
      assert.equal(request.itemName, 'Kettle')
      assert.deepEqual(getItemRequest(9), request)
    })

    it('rejects an unknown request with a 404', async () => {
      await assert.rejects(fetchItemRequest(999), { name: 'ApiError', status: 404 })
    })
  })

  describe('closing a request', () => {
    it('closes your own request on the server and in the cache', async () => {
      const request = await closeItemRequest(2)
      assert.equal(request.status, 'closed')
      assert.equal(stored(2).status, 'closed')
      assert.equal(getItemRequest(2).status, 'closed')
    })

    it('rejects closing someone else\'s request', async () => {
      await assert.rejects(closeItemRequest(1), {
        name: 'ApiError', status: 403, message: 'Only the requester can close this request.',
      })
      assert.equal(stored(1).status, 'open')
    })
  })

  describe('reply summaries on My requests cards', () => {
    it('still reports a reply whose chat is not cached yet', () => {
      const response = getLatestResponse({
        responses: [{ responderId: 'student-2', conversationId: 999, messageIds: [5] }],
      })
      assert.equal(response.responderId, 'student-2')
      assert.equal(response.chatLoaded, false)
      assert.equal(response.offer, null)
    })

    it('marks a reply whose chat is cached as loaded', () => {
      const response = getLatestResponse({
        responses: [{ responderId: 'student-2', conversationId: 1, messageIds: [2] }],
      })
      assert.equal(response.chatLoaded, true)
      assert.equal(response.offer.totalPrice, 18)
    })

    it('returns null when there are no replies', () => {
      assert.equal(getLatestResponse({ responses: [] }), null)
    })
  })
})
