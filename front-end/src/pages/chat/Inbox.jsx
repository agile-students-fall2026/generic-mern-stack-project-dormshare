import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Conversation from './Conversation'
import { useAutoRefresh } from './useAutoRefresh'
import { CURRENT_USER_ID, formatDate, getListing, listingImage } from '../../services/bookings'
import { formatSentAt, getLastMessage, getOtherParticipant } from '../../services/chat'
import { fetchConversations } from '../../services/chatApi'
import '../../styles/messages.css'
import './chat.css'

function previewText(message) {
  const mine = message.senderId === CURRENT_USER_ID
  if (message.type === 'offer') {
    const label = mine ? 'You offered' : 'Offer received'
    return `${label}: $${message.totalPrice} for ${formatDate(message.startDate)} – ${formatDate(message.endDate)}`
  }
  return mine ? `You: ${message.text}` : message.text
}

// Messages list (prototype m18). /inbox?conversation=<id> opens one conversation (m19).
function Inbox() {
  const [searchParams] = useSearchParams()
  const conversationId = searchParams.get('conversation')

  if (conversationId) {
    return <Conversation key={conversationId} conversationId={conversationId} />
  }
  return <ConversationList />
}

// Loads the current user's conversations from the API (#104).
function ConversationList() {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    fetchConversations().then(
      (conversations) => { if (current) setResult({ conversations }) },
      (error) => { if (current) setResult({ error }) },
    )
    return () => { current = false }
  }, [attempt])

  // Shows new conversations and replies without reloading. Only refreshes a list that
  // loaded; a failed refresh keeps the list on screen instead of showing an error.
  useAutoRefresh(async () => {
    if (!result?.conversations) return
    const conversations = await fetchConversations()
    setResult((current) => (current?.conversations ? { conversations } : current))
  })

  return (
    <main className="ds-page ds-messages chat-page">
      <h1 className="ds-heading">Messages</h1>
      {!result ? (
        <p className="ds-feedback" role="status">Loading conversations...</p>
      ) : result.error ? (
        <>
          <p className="ds-feedback ds-feedback--error" role="alert">
            Could not load conversations. {result.error.message}
          </p>
          <button type="button" className="ds-button ds-button--secondary" onClick={() => {
            setResult(null)
            setAttempt((value) => value + 1)
          }}>Try again</button>
        </>
      ) : result.conversations.length === 0 ? (
        <p className="ds-feedback">No conversations yet.</p>
      ) : (
        result.conversations.map((c) => {
          const listing = getListing(c.listingId)
          const other = getOtherParticipant(c, CURRENT_USER_ID)
          const last = getLastMessage(c)
          return (
            <Link key={c.id} to={`/inbox?conversation=${c.id}`} className="ds-message-surface chat-card chat-row">
              <img src={listingImage(c.listingId, 96)} alt={listing?.title ?? ''} />
              <div className="chat-row-text">
                <h2>{other?.name ?? 'Student'}</h2>
                <p className="chat-item-title">{listing?.title ?? 'Listing unavailable'}</p>
                {last && <p>{previewText(last)}</p>}
                {last && <span className="chat-time">{formatSentAt(last.sentAt)}</span>}
              </div>
            </Link>
          )
        })
      )}
    </main>
  )
}

export default Inbox
