
import { useContext } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import '../../styles/accounts.css'
import './profile.css'

function Profile() {
  const { currentUser, signOut } = useContext(AuthContext)
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/')
  }

  if (!currentUser) return <Navigate to="/login" replace />

  return (
    <main className="ds-page ds-account ds-account--profile">
      <h1 className="ds-heading">Profile</h1>

      <section
        className="ds-account-surface"
        aria-labelledby="profile-identity-heading"
      >
        <h2 id="profile-identity-heading">
          {currentUser.displayName || currentUser.email}
        </h2>
        <p>
          <span className="ds-status">
            {currentUser.emailVerified
              ? 'Demo email confirmed'
              : 'Demo email not confirmed'}
          </span>
        </p>
        <p>{currentUser.email}</p>
        {currentUser.campusArea && <p>{currentUser.campusArea}</p>}
        <p className="ds-account-help">
          This profile is part of the account demo.
          Account changes reset when you reload.
        </p>
      </section>

      <section
        className="profile-section"
        aria-labelledby="profile-mine-heading"
      >
        <h2 id="profile-mine-heading">My listings and requests</h2>
        <div className="ds-account-actions">
          <Link to="/listings" className="ds-button ds-button--secondary">
            My listings
          </Link>
          <Link to="/renter-dashboard#saved-items-heading" className="ds-button ds-button--secondary">
            Saved listings
          </Link>
          <Link to="/requests-board?tab=mine" className="ds-button ds-button--secondary">
            My requests
          </Link>
          <Link to="/requests-board?tab=answered" className="ds-button ds-button--secondary">
            Answered requests
          </Link>
        </div>
        <nav className="profile-links" aria-label="Activity">
          <Link to="/renter-dashboard" className="ds-text-link">
            Borrowing activity
          </Link>
          <Link to="/owner-dashboard" className="ds-text-link">
            Lending activity
          </Link>
        </nav>
      </section>

      <section
        className="profile-section"
        aria-labelledby="profile-account-heading"
      >
        <h2 id="profile-account-heading">Account</h2>
        <div className="ds-account-actions">
          <Link
            to={`/users/${currentUser.id}/reputation`}
            className="ds-button ds-button--secondary"
          >
            View reputation
          </Link>
        </div>
        <nav className="profile-links" aria-label="Profile tools">
          <Link to="/inbox" className="ds-text-link">
            Messages
          </Link>
          <Link to="/community-rules" className="ds-text-link">
            Community rules
          </Link>
          <Link to="/report" className="ds-text-link">
            Report a problem
          </Link>
          <Link to="/setup-profile" className="ds-text-link">
            Edit profile
          </Link>
        </nav>
        <button
          type="button"
          className="ds-button profile-signout"
          onClick={handleSignOut}
        >
          Sign out
        </button>
      </section>
    </main>
  )
}

export default Profile