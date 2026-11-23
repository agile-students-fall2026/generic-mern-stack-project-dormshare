import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AuthContext } from '../../context/AuthContext'
import { api } from '../../services/api.js'

function DemoLogin({ disabled, onBusyChange, onSignedIn }) {
  const { signInDemo } = useContext(AuthContext)
  const [result, setResult] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [userId, setUserId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mounted = useRef(false)

  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    let active = true
    api('/auth/demo-users').then(
      (users) => {
        if (!active) return
        setResult({ users })
        setUserId(users[0]?.id ?? '')
      },
      (loadError) => {
        if (active) setResult(loadError.status === 404 ? { hidden: true } : { error: loadError })
      },
    )
    return () => { active = false }
  }, [attempt])

  async function handleSubmit(event) {
    event.preventDefault()
    if (disabled || busy || !userId) return

    setBusy(true)
    onBusyChange(true)
    setError('')
    try {
      await signInDemo(userId)
      if (mounted.current) onSignedIn()
    } catch (signInError) {
      if (mounted.current) setError(signInError.message || 'Could not open this demo account.')
    } finally {
      if (mounted.current) {
        setBusy(false)
        onBusyChange(false)
      }
    }
  }

  if (result?.hidden) return null

  return (
    <section className="ds-account-surface" aria-labelledby="demo-login-heading">
      <h2 id="demo-login-heading">Try a demo account</h2>
      <p className="ds-account-help">
        Choose a sample user to test their rentals and messages. Sample changes reset when the backend restarts.
      </p>
      {!result ? (
        <p role="status">Loading demo accounts...</p>
      ) : result.error ? (
        <>
          <p className="ds-account-error" role="alert">Could not load demo accounts. {result.error.message}</p>
          <button type="button" className="ds-button ds-button--secondary" disabled={disabled} onClick={() => {
            setResult(null)
            setAttempt((value) => value + 1)
          }}>Try again</button>
        </>
      ) : result.users.length === 0 ? (
        <p>No sample accounts are available.</p>
      ) : (
        <form className="ds-account-form" onSubmit={handleSubmit}>
          <div className="ds-account-field">
            <label htmlFor="demoUser">Sample user</label>
            <select id="demoUser" className="ds-field" value={userId} disabled={disabled || busy}
              onChange={(event) => { setUserId(event.target.value); setError('') }}>
              {result.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.borrowedRentals} rentals · {user.conversations} chats
                </option>
              ))}
            </select>
          </div>
          {error && <p className="ds-account-error" role="alert">{error}</p>}
          <div className="ds-account-actions">
            <button type="submit" className="ds-button ds-button--secondary" disabled={disabled || busy || !userId}>
              {busy ? 'Opening demo...' : 'Sign in to demo'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

export default DemoLogin
