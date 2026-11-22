import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createApp } from '../../back-end/app.js'
import { mockData } from '../../back-end/test/fixtures.js'
import { startTestServer } from '../../back-end/test/helpers/server.js'
import { setSessionToken } from '../src/services/api.js'
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
