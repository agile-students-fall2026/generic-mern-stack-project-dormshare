import assert from 'node:assert/strict'
import { after, afterEach, before, beforeEach, describe, it } from 'node:test'
import { createApp } from '../../back-end/app.js'
import { startTestServer } from '../../back-end/test/helpers/server.js'
import { getBooking } from '../src/services/bookings.js'
import { fetchBooking } from '../src/services/bookingsApi.js'
import { getConversation } from '../src/services/chat.js'
import {
  acceptChatOffer, declineChatOffer, fetchConversation, fetchConversations, sendChatMessage, sendChatOffer,
  startConversation,
} from '../src/services/chatApi.js'
import { getItemRequest, sendItemRequestResponse } from '../src/services/itemRequests.js'
import { getConversations, loadMockData } from '../src/services/mockDataService.js'
import { mockResponse } from './fixtures.js'

// Runs the front-end chat service against the real Express routes. The current user
// is owner-1. Conversation 1 is with student-2 about their Projector (listing 2) and
// ends with student-2's pending offer.
describe('Chat and offer API integration (#104)', () => {
  const nativeFetch = globalThis.fetch
  let data
  let app
  let server
  const stored = (id) => data.conversations.find((conversation) => conversation.id === id)

  before(async () => {
    app = createApp({ store: { load: async () => data } })
    server = await startTestServer(app)
    globalThis.fetch = (url, options) => nativeFetch(new URL(url, server.baseUrl), options)
    data = mockResponse()
    await loadMockData()
  })

  beforeEach(() => {
    data = mockResponse()
    Object.assign(data.conversations[0].messages[1], { startDate: '2099-01-10', endDate: '2099-01-12' })
    app.locals.mockDataStore.load = async () => data
  })

  after(async () => {
    globalThis.fetch = nativeFetch
    await server?.close()
  })

  it('loads the inbox from the server and caches it', async () => {
    const conversations = await fetchConversations()
    assert.deepEqual(conversations, data.conversations)
    assert.deepEqual(getConversation(1), data.conversations[0])
  })

  it('drops cached conversations the server no longer has, such as after a restart', async () => {
    data.conversations = []
    assert.deepEqual(await fetchConversations(), [])
    assert.equal(getConversations().some((conversation) => conversation.participantIds.includes('owner-1')), false)
  })

  it('sends a message that the server saves', async () => {
    const conversation = await sendChatMessage(1, 'On my way.')
    const message = conversation.messages.at(-1)
    assert.equal(message.text, 'On my way.')
    assert.equal(message.senderId, 'owner-1')
    assert.deepEqual(stored(1).messages.at(-1), message)
    assert.deepEqual(getConversation(1), conversation)
  })

  it('sends a counteroffer and reloads the countered offer', async () => {
    const conversation = await sendChatOffer(1, { totalPrice: 15, startDate: '2099-01-10', endDate: '2099-01-12' })
    assert.deepEqual(conversation.messages.slice(-2).map((message) => message.status), ['countered', 'pending'])
    assert.equal(conversation.messages.at(-1).totalPrice, 15)
  })

  it('declines an offer on the server', async () => {
    const conversation = await declineChatOffer(1, 2)
    assert.equal(conversation.messages[1].status, 'declined')
    assert.equal(stored(1).messages[1].status, 'declined')
  })

  it('accepts an offer as a server booking that the booking page can open', async () => {
    const booking = await acceptChatOffer(1, 2)
    assert.equal(booking.status, 'confirmed')
    assert.equal(booking.borrowerId, 'owner-1')
    assert.equal(booking.totalPrice, 18)
    assert.deepEqual(data.rentals.at(-1), booking)
    assert.deepEqual(getBooking(booking.id), booking, 'cached for pages that read synchronously')
    assert.deepEqual(await fetchBooking(booking.id), booking, 'Booking Details loads it from the server')
    assert.equal(getConversation(1).messages[1].bookingId, booking.id)
  })

  it('surfaces server errors and leaves the cache unchanged', async () => {
    await fetchConversations()
    const before = getConversation(1)
    await assert.rejects(sendChatMessage(1, '   '), { name: 'ApiError', status: 400 })
    await assert.rejects(acceptChatOffer(1, 1), { name: 'ApiError', status: 404, message: 'Offer not found.' })
    await assert.rejects(fetchConversation(999), { name: 'ApiError', status: 404 })
    assert.deepEqual(getConversation(1), before)
  })

  describe('when only the reload after a change fails', () => {
    let routedFetch

    // The change itself reaches the server; reloading conversation 1 afterwards fails.
    beforeEach(async () => {
      await fetchConversation(1)
      routedFetch = globalThis.fetch
      globalThis.fetch = (url, options) =>
        url === '/api/conversations/1' && options?.method === 'GET'
          ? Promise.reject(new TypeError('offline'))
          : routedFetch(url, options)
    })

    afterEach(() => { globalThis.fetch = routedFetch })

    it('still reports a sent message as sent, so it is not sent twice', async () => {
      const conversation = await sendChatMessage(1, 'On my way.')
      assert.equal(conversation.messages.at(-1).text, 'On my way.')
      assert.deepEqual(getConversation(1), conversation)
      assert.equal(stored(1).messages.filter((message) => message.text === 'On my way.').length, 1)
    })

    it('applies a counteroffer locally, including the countered offer', async () => {
      const conversation = await sendChatOffer(1, { totalPrice: 15, startDate: '2099-01-10', endDate: '2099-01-12' })
      assert.deepEqual(conversation.messages.map((message) => message.status), [undefined, 'countered', 'pending'])
      assert.deepEqual(conversation, stored(1))
    })

    it('applies a decline locally', async () => {
      assert.equal((await declineChatOffer(1, 2)).messages[1].status, 'declined')
    })

    it('still returns the booking from an accepted offer', async () => {
      const booking = await acceptChatOffer(1, 2)
      assert.equal(booking.status, 'confirmed')
      assert.deepEqual(getBooking(booking.id), booking)
      assert.equal(getConversation(1).messages[1].status, 'accepted')
      assert.equal(getConversation(1).messages[1].bookingId, booking.id)
    })
  })

  it('still reports a change the server refused as a failure', async () => {
    await fetchConversation(1)
    await assert.rejects(sendChatMessage(1, '   '), { name: 'ApiError', status: 400 })
    assert.equal(stored(1).messages.length, 2)
  })

  describe('starting a conversation from a listing or booking', () => {
    it('opens a new chat with the owner of a published listing', async () => {
      data.listings.push({ ...data.listings[1], id: 3, title: 'Speaker' })
      const conversation = await startConversation({ listingId: '3', participantId: 'student-2' })
      assert.deepEqual(conversation.participantIds, ['owner-1', 'student-2'])
      assert.deepEqual(conversation.messages, [])
      assert.deepEqual(stored(conversation.id), conversation)
      assert.deepEqual(getConversation(conversation.id), conversation, 'cached so the chat page opens it')
    })

    it('reopens the existing chat about the same listing', async () => {
      const conversation = await startConversation({ listingId: 2, participantId: 'student-2' })
      assert.equal(conversation.id, 1)
      assert.equal(data.conversations.length, 1)
    })

    it('surfaces the server message when starting a chat is not allowed', async () => {
      data.listings.push({ ...data.listings[1], id: 3, title: 'Speaker', status: 'paused' })
      await assert.rejects(startConversation({ listingId: 3, participantId: 'student-2' }), {
        name: 'ApiError',
        status: 403,
        message: 'You can only message the owner of a published listing or someone you have a booking with.',
      })
      assert.equal(data.conversations.length, 1)
    })
  })

  it('responds to an item request with a chat the chat pages can open', async () => {
    const conversationId = await sendItemRequestResponse(1, { listingId: '1', message: 'I can lend mine.', totalPrice: 12 })
    const conversation = await fetchConversation(conversationId)
    assert.deepEqual(conversation.participantIds, ['owner-1', 'student-2'])
    assert.deepEqual(conversation.messages.map((message) => message.type), ['text', 'offer'])
    assert.deepEqual(stored(conversationId), conversation)
    assert.deepEqual(getItemRequest(1).responses, [
      { responderId: 'owner-1', conversationId, messageIds: conversation.messages.map((message) => message.id) },
    ])
  })

  it('rejects a response the server refuses', async () => {
    await assert.rejects(sendItemRequestResponse(2, { listingId: 1, message: 'Hi' }), {
      name: 'ApiError', status: 403, message: 'You cannot respond to your own request.',
    })
  })
})
