import { NavLink } from 'react-router-dom'
import './ActivityTabs.css'

// One "Activity" area with two views, so the two dashboards read as a single place.
function ActivityTabs() {
  return (
    <nav className="ds-activity-tabs" aria-label="Activity">
      <NavLink to="/renter-dashboard">Borrowing</NavLink>
      <NavLink to="/owner-dashboard">Lending</NavLink>
    </nav>
  )
}

export default ActivityTabs
