import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { createApp } from '../../back-end/app.js'
import { startTestServer } from '../../back-end/test/helpers/server.js'
import { ApiError } from '../src/services/api.js'
import { createQuickBorrowRequest } from '../src/services/quickBorrow.js'
import { fetchBoardRequests } from '../src/services/requestsBoard.js'
import { mockResponse } from './fixtures.js'

// Runs the front-end services against the real Express routes. The current user is owner-1.
// Fixtures: "USB-C phone charger" (quick) and "Rice cooker" (item) are student-2's,
// "HDMI cable" (item) is owner-1's.
describe('Quick Borrow and requests board API integration (#114)', () => {
  const nativeFetch = globalThis.fetch
  const form = {
    itemName: '  Stapler  ',
    neededBy: '2030-12-01',
    neededTime: '14:30',
    borrowDuration: ' 20 minutes ',
    approximateArea: ' Library ',
    details: ' Just for one form. ',
  }
  let data
  let app
  let server

  before(async () => {
    app = createApp({ store: { load: async () => data } })
    server = await startTestServer(app)
    globalThis.fetch = (url, options) => nativeFetch(new URL(url, server.baseUrl), options)
  })

  beforeEach(() => {
    data = mockResponse()
    app.locals.mockDataStore.load = async () => data
  })

  after(async () => {
    globalThis.fetch = nativeFetch
    await server.close()
  })

  describe('posting a quick borrow request', () => {
    it('saves the trimmed request on the server as the current user', async () => {
      const saved = await createQuickBorrowRequest(form)
      assert.equal(saved.itemName, 'Stapler')
      assert.equal(saved.borrowDuration, '20 minutes')
      assert.equal(saved.requesterId, 'owner-1')
      assert.equal(saved.status, 'open')
      assert.deepEqual(data.quickBorrowRequests.at(-1), saved)
    })

    it('shows the new request under My requests, newest first', async () => {
      const saved = await createQuickBorrowRequest(form)
      const mine = await fetchBoardRequests('mine')
      assert.deepEqual(mine.map((item) => item.id), [saved.id, 2])
      assert.deepEqual(mine.map((item) => item.type), ['quick', 'item'])
      assert.deepEqual((await fetchBoardRequests('all')).map((item) => item.itemName), ['Rice cooker', 'USB-C phone charger'])
    })

    it('surfaces the server message when the request is rejected', async () => {
      await assert.rejects(
        createQuickBorrowRequest({ ...form, neededBy: 'soon' }),
        (error) => error instanceof ApiError && error.status === 400 && /neededBy/.test(error.message),
      )
      assert.equal(data.quickBorrowRequests.length, 1)
    })
  })

  describe('loading the board', () => {
    it('lists only other people\'s requests on the all, quick and item tabs', async () => {
      const all = await fetchBoardRequests('all')
      assert.deepEqual(all.map((item) => `${item.type}:${item.itemName}`), ['item:Rice cooker', 'quick:USB-C phone charger'])
      assert.deepEqual((await fetchBoardRequests('quick')).map((item) => item.itemName), ['USB-C phone charger'])
      assert.deepEqual((await fetchBoardRequests('item')).map((item) => item.itemName), ['Rice cooker'])
    })

    it('lists your own item request under My requests', async () => {
      assert.deepEqual((await fetchBoardRequests('mine')).map((item) => item.itemName), ['HDMI cable'])
    })

    it('rejects an unknown tab with the server message', async () => {
      await assert.rejects(
        fetchBoardRequests('bogus'),
        (error) => error instanceof ApiError && error.status === 400 && /type must be one of/.test(error.message),
      )
    })
  })
})
