import { useContext, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from '../../services/notifications.js'
import '../../styles/trust.css'
import './notifications.css'

function formatCreatedAt(value) {
  if (typeof value !== 'string' || !value) return null

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(value.includes('T')
      ? { hour: 'numeric', minute: '2-digit' }
      : { timeZone: 'UTC' }),
  }).format(date)
}

function NotificationsForUser() {
  const [notifications, setNotifications] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [pending, setPending] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    getNotifications().then(
      (items) => {
        if (active) { setNotifications(items); setLoadError(''); setLoading(false) }
      },
      (error) => {
        if (active) { setLoadError(error.message); setLoading(false) }
      },
    )
    return () => { active = false }
  }, [reload])

  const unreadCount = notifications.filter(
    (notification) => !notification.isRead
  ).length

  const visibleNotifications = notifications.filter(
    (notification) =>
      filter === 'all' || !notification.isRead
  )

  async function handleReadChange(id, shouldRead) {
    setPending(true)
    setActionError('')
    try {
      const updated = await (shouldRead
        ? markNotificationRead(id) : markNotificationUnread(id))
      setNotifications((items) => items.map((item) => item.id === id ? updated : item))
    } catch (error) {
      setActionError(error.message)
    } finally {
      setPending(false)
    }
  }

  async function handleMarkAllRead() {
    setPending(true)
    setActionError('')
    try {
      setNotifications(await markAllNotificationsRead())
    } catch (error) {
      setActionError(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="ds-page ds-trust notifications-page">
      <header className="trust-header notifications-header">
        <div>
          <h1 className="ds-heading">Notifications</h1>
          <p>Updates about your rentals, requests, and messages.</p>
        </div>

        <Link to="/browse" className="ds-text-link notifications-back">
          Back to Browse
        </Link>
      </header>

      <section
        className="notifications-panel"
        aria-label="Your notifications"
      >
        <div className="notifications-toolbar">
          <div
            className="notifications-filters"
            role="group"
            aria-label="Filter notifications"
          >
            <button
              type="button"
              className={
                filter === 'all'
                  ? 'ds-button ds-button--primary notifications-filter notifications-filter--active'
                  : 'ds-button ds-button--secondary notifications-filter'
              }
              aria-pressed={filter === 'all'}
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </button>

            <button
              type="button"
              className={
                filter === 'unread'
                  ? 'ds-button ds-button--primary notifications-filter notifications-filter--active'
                  : 'ds-button ds-button--secondary notifications-filter'
              }
              aria-pressed={filter === 'unread'}
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
          </div>

          <button
            type="button"
            className="ds-button ds-button--secondary notifications-mark-all"
            disabled={pending || unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </button>
        </div>

        {actionError && <p role="alert">Could not update notification. {actionError}</p>}
        {loading ? (
          <p role="status">Loading notifications...</p>
        ) : loadError ? (
          <p role="alert">
            Could not load notifications. {loadError}{' '}
            <button type="button" onClick={() => {
              setLoading(true)
              setReload((value) => value + 1)
            }}>Retry</button>
          </p>
        ) : visibleNotifications.length === 0 ? (
          <div className="trust-empty notifications-empty">
            <h2>
              {filter === 'unread'
                ? "You're all caught up!"
                : 'No notifications yet'}
            </h2>
            <p>
              {filter === 'unread'
                ? 'You have no unread notifications.'
                : 'Your DormShare updates will appear here.'}
            </p>
          </div>
        ) : (
          <ul className="notifications-list">
            {visibleNotifications.map((notification) => {
              const readAction = notification.isRead
                ? 'Mark as unread'
                : 'Mark as read'
              const createdLabel = formatCreatedAt(notification.createdAt)

              return (
                <li
                  key={notification.id}
                  className={
                    notification.isRead
                      ? 'notifications-item'
                      : 'notifications-item notifications-item--unread'
                  }
                >
                  <div className="notifications-item-header">
                    <h2>{notification.title}</h2>

                    {!notification.isRead && (
                      <span className="ds-status notifications-unread-label">
                        <span
                          className="notifications-dot"
                          aria-hidden="true"
                        />
                        Unread
                      </span>
                    )}
                  </div>

                  <p>{notification.message}</p>

                  <span className="trust-meta notifications-category">
                    {notification.category}
                    {createdLabel && (
                      <>
                        {' · '}
                        <time dateTime={notification.createdAt}>
                          {createdLabel}
                        </time>
                      </>
                    )}
                  </span>

                  <div className="notifications-actions">
                    <Link
                      to={notification.to}
                      className="ds-button ds-button--primary notifications-view"
                      aria-label={`View details for ${notification.title}`}
                      onClick={() => handleReadChange(notification.id, true)}
                    >
                      View details
                    </Link>

                    <button
                      type="button"
                      disabled={pending}
                      className="ds-button ds-button--secondary notifications-read-action"
                      aria-label={`${readAction} for ${notification.title}`}
                      onClick={() =>
                        handleReadChange(notification.id, !notification.isRead)
                      }
                    >
                      {readAction}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}

// Reset notification state when another student signs in.
function Notifications() {
  const { currentUser } = useContext(AuthContext)
  return <NotificationsForUser key={currentUser?.id ?? 'guest'} />
}

export default Notifications
