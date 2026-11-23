import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import RequestCard from './RequestCard'
import { REQUEST_TYPES, fetchBoardRequests } from '../../services/requestsBoard'
import './requestsBoard.css'
import '../../styles/messages.css'

const TABS = [['all', 'All'], ...Object.entries(REQUEST_TYPES), ['mine', 'My requests']]

// Shared board of item requests and quick borrow requests.
function RequestsBoard() {
  const [type, setType] = useState('all')
  const [attempt, setAttempt] = useState(0)
  // The last answer from the API, tagged with the tab and attempt it was for.
  const [result, setResult] = useState(null)
  const key = `${type}:${attempt}`

  useEffect(() => {
    let current = true
    fetchBoardRequests(type).then(
      (requests) => { if (current) setResult({ key, requests }) },
      (error) => { if (current) setResult({ key, error }) },
    )
    return () => { current = false }
  }, [type, attempt, key])

  const loaded = result?.key === key ? result : null
  const requests = loaded?.requests ?? []

  return (
    <main className="ds-page ds-messages ds-request-board">
      <header className="request-board-header">
        <h1 className="ds-heading">Requests</h1>
        <div className="request-actions">
          <Link to="/requests?new" className="ds-button ds-button--primary">
            Post an item request
          </Link>
          <Link to="/quick-borrow" className="ds-button ds-button--secondary">
            Post a quick borrow
          </Link>
        </div>
      </header>

      <div className="request-tabs" role="group" aria-label="Request type">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
                        aria-pressed={type === value}
            className="ds-button ds-button--secondary request-tab"
            onClick={() => setType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {!loaded ? (
        <p className="ds-status" role="status">Loading requests...</p>
      ) : loaded.error ? (
        <>
          <p className="ds-feedback ds-feedback--error" role="alert">Could not load requests. {loaded.error.message}</p>
          <button type="button" className="ds-button ds-button--secondary" onClick={() => setAttempt((value) => value + 1)}>
            Retry
          </button>
        </>
      ) : requests.length === 0 ? (
        <p className="ds-feedback">{type === 'mine' ? "You haven't posted any requests yet." : 'No requests yet.'}</p>
      ) : (
        <div className="request-board-grid">
          {requests.map((request) => (
            <RequestCard key={`${request.type}-${request.id}`} request={request} />
          ))}
        </div>
      )}
    </main>
  )
}

export default RequestsBoard
