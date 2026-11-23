import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startConversation } from '../services/chatApi'

// Opens the chat with another student about a listing, starting one if needed, and
// shows the server's message if that isn't allowed.
function MessageButton({ listingId, participantId, className = 'ds-button ds-button--secondary', children }) {
  const navigate = useNavigate()
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState(null)

  const handleClick = async () => {
    if (opening) return
    setOpening(true)
    setError(null)
    try {
      const conversation = await startConversation({ listingId, participantId })
      navigate(`/inbox?conversation=${conversation.id}`)
    } catch (startError) {
      setError(startError)
      setOpening(false)
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={opening} onClick={handleClick}>
        {opening ? 'Opening chat...' : children}
      </button>
      {error && <p className="ds-feedback ds-feedback--error" role="alert">Could not open the chat. {error.message}</p>}
    </>
  )
}

export default MessageButton
