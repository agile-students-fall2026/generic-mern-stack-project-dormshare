import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../../back-end/app.js'
import { mockData } from '../../back-end/test/fixtures.js'
import { startTestServer } from '../../back-end/test/helpers/server.js'
import { setSessionToken } from '../src/services/api.js'
import {
  sendChatMessage, sendChatOffer, acceptChatOffer,
} from '../src/services/chatApi.js'
import { confirmReturnRequest } from '../src/services/bookingsApi.js'
import {
  getNotifications, getUnreadCount, markAllNotificationsRead,
  markNotificationRead, markNotificationUnread,
} from '../src/services/notifications.js'

test('notifications load, persist read state, and isolate users through Express', async (t) => {
  const data = mockData()
  data.rentals.push({ ...data.rentals[0], id: 102, status: 'requested' })
  const app = createApp({ store: { load: async () => data } })
  const server = await startTestServer(app)
  const originalFetch = globalThis.fetch
  t.after(async () => {
    globalThis.fetch = originalFetch
    setSessionToken(null)
    await server.close()
  })
  globalThis.fetch = (url, options) => originalFetch(new URL(url, server.baseUrl), options)
  setSessionToken(null)

  const before = await getNotifications()
  const requested = before.find((item) => item.id === 'rental-102-requested')
  assert.equal(requested?.to, '/bookings/102')
  assert.equal(requested.isRead, false)
  assert.equal(await getUnreadCount(), before.length)

  assert.equal((await markNotificationRead(requested.id)).isRead, true)
  assert.equal((await getNotifications()).find((item) => item.id === requested.id).isRead, true)
  assert.equal((await markNotificationUnread(requested.id)).isRead, false)
  assert.equal((await getNotifications()).find((item) => item.id === requested.id).isRead, false)
  assert.ok((await markAllNotificationsRead()).every((item) => item.isRead))
  assert.equal(await getUnreadCount(), 0)
  await assert.rejects(markNotificationRead('message-1-1'), { status: 404 })

  data.rentals.at(-1).status = 'confirmed'
  const changed = await getNotifications()
  assert.equal(changed.find((item) => item.id === 'rental-102-confirmed').isRead, false)
  assert.equal(changed.some((item) => item.id === requested.id), false)

  const token = 'a'.repeat(64)
  app.locals.auth.sessions.set(token, 'student-2')
  setSessionToken(token)
  const student = await getNotifications()
  assert.equal(student.some((item) => item.id === 'rental-102-requested'), false)
  assert.ok(student.some((item) => item.id === 'message-1-1'))
  assert.equal(student.find((item) => item.id === 'rental-101-completed').isRead, false)
  assert.equal(student.find((item) => item.id === 'rental-102-confirmed').isRead, false)

  await assert.rejects(markNotificationRead('message-does-not-exist'), { status: 404 })
  await assert.rejects(markNotificationRead('rental-102-requested'), { status: 404 })
  setSessionToken('b'.repeat(64))
  await assert.rejects(getNotifications(), { status: 401 })
})

test('notification API failures are surfaced instead of falling back to mock data', async (t) => {
  setSessionToken(null)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Notifications unavailable.' }, { status: 503 }))
  await assert.rejects(getNotifications(), {
    name: 'ApiError', status: 503, message: 'Notifications unavailable.',
  })
})

test('confirming a return updates server notifications', async (t) => {
  const data = mockData()
  const rental = data.rentals[0]
  rental.status = 'active'
  rental.endDate = '2000-01-01'

  const app = createApp({ store: { load: async () => data } })
  const server = await startTestServer(app)
  const nativeFetch = globalThis.fetch

  t.after(async () => {
    globalThis.fetch = nativeFetch
    setSessionToken(null)
    await server.close()
  })

  globalThis.fetch = (url, options) =>
    nativeFetch(new URL(url, server.baseUrl), options)
  setSessionToken(null)

  const overdueId = 'rental-101-overdue-2000-01-01'

  const before = await getNotifications()
  assert.equal(
    before.find((item) => item.id === overdueId)?.title,
    'Return overdue'
  )

  // Use the actual frontend service, not a direct fixture mutation.
  const completed = await confirmReturnRequest(101, {
    condition: 'As described',
  })

  assert.equal(completed.status, 'completed')
  assert.equal(rental.status, 'completed')

  const after = await getNotifications()

  assert.equal(
    after.find((item) => item.id === 'rental-101-completed')?.title,
    'Rental completed'
  )
  assert.equal(after.some((item) => item.id === overdueId), false)
})

test('chat producers create server-backed notifications', async (t) => {
  const data = mockData()
  const app = createApp({ store: { load: async () => data } })
  const server = await startTestServer(app)
  const nativeFetch = globalThis.fetch
  const studentToken = 'c'.repeat(64)

  app.locals.auth.sessions.set(studentToken, 'student-2')

  t.after(async () => {
    globalThis.fetch = nativeFetch
    setSessionToken(null)
    await server.close()
  })

  globalThis.fetch = (url, options) =>
    nativeFetch(new URL(url, server.baseUrl), options)

  setSessionToken(null)

  // Owner sends a message through the actual chat API service.
  const conversation = await sendChatMessage(1, 'Is the lamp available?')
  const message = conversation.messages.at(-1)

  assert.equal(message.senderId, 'owner-1')
  assert.equal(data.conversations[0].messages.at(-1).id, message.id)

  // Recipient receives the newly created unread notification.
  setSessionToken(studentToken)

  const messageId = `message-1-${message.id}`
  const received = (await getNotifications())
    .find((item) => item.id === messageId)

  assert.equal(received?.title, 'New message')
  assert.equal(received?.isRead, false)
  assert.equal(received?.to, '/inbox?conversation=1')
  assert.equal(received?.createdAt, message.sentAt)

  // The sender must not receive their own message notification.
  setSessionToken(null)
  assert.equal(
    (await getNotifications()).some((item) => item.id === messageId),
    false
  )

  // Borrower sends a real offer through the chat API.
  setSessionToken(studentToken)

  const withOffer = await sendChatOffer(1, {
    totalPrice: 15,
    startDate: '2099-01-10',
    endDate: '2099-01-12',
  })

  const offer = withOffer.messages.at(-1)
  assert.equal(offer.type, 'offer')
  assert.equal(offer.senderId, 'student-2')

  // Owner receives an unread offer notification.
  setSessionToken(null)

  const offerNotice = (await getNotifications())
    .find((item) => item.id === `message-1-${offer.id}`)

  assert.equal(offerNotice?.title, 'Offer received')
  assert.equal(offerNotice?.isRead, false)

  // Accepting the offer must create a booking on the server.
  const booking = await acceptChatOffer(1, offer.id)

  assert.equal(booking.status, 'confirmed')
  assert.equal(
    data.rentals.some((rental) => rental.id === booking.id),
    true
  )

  // The new booking is immediately visible to notifications.
  const bookingId = `rental-${booking.id}-confirmed`

  const ownerNotice = (await getNotifications())
    .find((item) => item.id === bookingId)

  assert.equal(ownerNotice?.title, 'Booking confirmed')
  assert.equal(ownerNotice?.isRead, false)
  assert.equal(ownerNotice?.to, `/bookings/${booking.id}`)

  // The borrower receives the confirmed booking too.
  setSessionToken(studentToken)

  const borrowerNotice = (await getNotifications())
    .find((item) => item.id === bookingId)

  assert.equal(borrowerNotice?.title, 'Booking confirmed')
  assert.equal(borrowerNotice?.isRead, false)
})
