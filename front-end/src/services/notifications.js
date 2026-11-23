import { api } from './api.js'

export const getNotifications = () => api('/notifications')
export const getUnreadCount = async () =>
  (await getNotifications()).filter((item) => !item.isRead).length

const setRead = (id, isRead) => api(`/notifications/${encodeURIComponent(id)}`, {
  method: 'PATCH', body: { isRead },
})

export const markNotificationRead = (id) => setRead(id, true)
export const markNotificationUnread = (id) => setRead(id, false)
export const markAllNotificationsRead = () =>
  api('/notifications/read-all', { method: 'POST' })
