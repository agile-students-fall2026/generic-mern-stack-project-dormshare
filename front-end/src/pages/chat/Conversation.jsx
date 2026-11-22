import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import OfferForm from './OfferForm'
import { CURRENT_USER_ID, formatDate, getListing, listingImage } from '../../services/bookings'
import { formatSentAt, getLatestOffer, getOtherParticipant, getPendingOffer } from '../../services/chat'
import {
  acceptChatOffer, declineChatOffer, fetchConversation, sendChatMessage, sendChatOffer,
} from '../../services/chatApi'

const OFFER_STATUS_LABELS = {
  pending: 'Waiting for reply',
  accepted: 'Accepted',
  declined: 'Declined',
  countered: 'Replaced by a new offer',
}

// One conversation with messages and rental offers (prototype m19, offer dialog m20).
// Loads from the API (#104); unknown and other people's conversations show as not found.
function Conversation({ conversationId }) {
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let current = true
    fetchConversation(conversationId).then(
      (conversation) => { if (current) setResult({ conversation }) },
      (error) => { if (current) setResult({ error }) },
    )
    return () => { current = false }
  }, [conversationId, attempt])

  if (result?.conversation) return <ConversationView initialConversation={result.conversation} />

  const notFound = result?.error && [403, 404].includes(result.error.status)
  return (
    <main className="ds-page ds-messages chat-page">
      <h1 className="ds-heading">Conversation</h1>
      {!result ? (
        <p className="ds-feedback" role="status">Loading conversation...</p>
      ) : notFound ? (
        <p className="ds-feedback">Conversation not found.</p>
      ) : (
        <>
          <p className="ds-feedback ds-feedback--error" role="alert">
            Could not load this conversation. {result.error.message}
          </p>
          <button type="button" className="ds-button ds-button--secondary" onClick={() => {
            setResult(null)
            setAttempt((value) => value + 1)
          }}>Try again</button>
        </>
      )}
      <Link to="/inbox" className="ds-text-link">Back to messages</Link>
    </main>
  )
}

function ConversationView({ initialConversation }) {
  const navigate = useNavigate()
  const [conversation, setConversation] = useState(initialConversation)
  const [draft, setDraft] = useState('')
  const [offerFormOpen, setOfferFormOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [actionError, setActionError] = useState(null)

  const listing = getListing(conversation.listingId)
  const other = getOtherParticipant(conversation, CURRENT_USER_ID)
  // Students who signed up after the app loaded aren't in the cached user list yet.
  const otherName = other?.name ?? 'Student'
  const pendingOffer = getPendingOffer(conversation)
  const latestOffer = getLatestOffer(conversation)
  const canRespond = pendingOffer && pendingOffer.senderId !== CURRENT_USER_ID

  // Runs one change against the API. Buttons are disabled while it is in flight, and a
  // failure keeps the draft. After a failure the conversation is reloaded, so an offer
  // the other student already answered or countered stops showing as pending.
  const run = async (action) => {
    if (pending) return false
    setPending(true)
    setActionError(null)
    try {
      await action()
      return true
    } catch (error) {
      setActionError(error)
      fetchConversation(conversation.id).then(setConversation, () => {})
      return false
    } finally {
      setPending(false)
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    const sent = await run(async () => setConversation(await sendChatMessage(conversation.id, text)))
    if (sent) setDraft('')
  }

  // Rejects on failure so the offer form can show the message and keep its values.
  const handleOffer = async (offer) => {
    setConversation(await sendChatOffer(conversation.id, offer))
    setOfferFormOpen(false)
  }

  const handleAccept = () => run(async () => {
    const booking = await acceptChatOffer(conversation.id, pendingOffer.id)
    navigate(`/bookings/${booking.id}`)
  })

  const handleDecline = () => run(async () => {
    setConversation(await declineChatOffer(conversation.id, pendingOffer.id))
  })

  return (
    <main className="ds-page ds-messages chat-page">
      <Link to="/inbox" className="ds-text-link">← Messages</Link>
      <h1 className="ds-heading">Conversation</h1>

      <div className="ds-message-surface chat-card chat-row">
        <img src={listingImage(conversation.listingId, 96)} alt={listing?.title ?? ''} />
        <div className="chat-row-text">
          <h2>{otherName}</h2>
          <p className="chat-item-title">{listing?.title ?? 'Listing unavailable'}</p>
          <p className="chat-time">
            {other?.completedRentals != null && <>{other.completedRentals} completed rentals · </>}
            {listing && <>${listing.price}/day</>}
          </p>
        </div>
      </div>

      <ol className="chat-messages">
        {conversation.messages.map((m) => {
          const mine = m.senderId === CURRENT_USER_ID
          return (
            <li key={m.id} className={mine ? 'chat-message chat-message--mine' : 'chat-message'}>
              {m.type === 'offer' ? (
                <div className={`ds-message-surface chat-offer chat-offer--${m.status}`}>
                  <h3>Rental offer · ${m.totalPrice} total</h3>
                  <p>{formatDate(m.startDate)} – {formatDate(m.endDate)}</p>
                  <div className="chat-offer-status">
                    <span className="ds-status">{OFFER_STATUS_LABELS[m.status]}</span>
                    {m.bookingId && <Link to={`/bookings/${m.bookingId}`} className="ds-text-link">View booking</Link>}
                  </div>
                </div>
              ) : (
                <p className="chat-bubble">{m.text}</p>
              )}
              <span className="chat-time">{mine ? 'You' : otherName} ·{formatSentAt(m.sentAt)}</span>
            </li>
          )
        })}
      </ol>

      {actionError && (
        <p className="ds-feedback ds-feedback--error" role="alert">
          Could not update this conversation. {actionError.message}
        </p>
      )}

      <div className="chat-actions" aria-busy={pending}>
        {canRespond && (
          <button type="button" className="ds-button ds-button--primary" disabled={pending} onClick={handleAccept}>
            {pending ? 'Saving...' : 'Accept and view booking'}
          </button>
        )}
        <button type="button" className="ds-button ds-button--secondary" disabled={pending} onClick={(e) => {
          e.currentTarget.focus()
          setOfferFormOpen(true)
        }}>
          {latestOffer ? 'Make / counter offer' : 'Make an offer'}
        </button>
        {canRespond && (
          <button
            type="button"
            className="ds-button ds-button--secondary ds-message-danger"
            disabled={pending}
            onClick={handleDecline}
          >
            Decline offer
          </button>
        )}
      </div>

      <form className="chat-send" onSubmit={handleSend}>
        <label htmlFor="chat-message">Message</label>
        <div className="chat-send-row">
          <input
            id="chat-message"
            className="ds-field"
            placeholder="Write a message"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="ds-button ds-button--primary" disabled={!draft.trim() || pending}>
            {pending ? 'Sending...' : 'Send'}
          </button>
        </div>
      </form>

      <Link to={`/report?conversationId=${conversation.id}`} className="ds-text-link">Report conversation</Link>

      {offerFormOpen && (
        <OfferForm
          listing={listing}
          initialOffer={latestOffer}
          onSubmit={handleOffer}
          onCancel={() => setOfferFormOpen(false)}
        />
      )}
    </main>
  )
}

export default Conversation
