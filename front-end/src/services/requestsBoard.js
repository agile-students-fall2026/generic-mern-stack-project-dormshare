// Shared requests board service. The board loads one list of Quick Borrow and
// item requests from the back-end (#114) instead of reading each source itself.
import { api } from './api.js'

// Item requests use the same field names as quick borrow requests at a minimum:
// id, itemName, neededBy, approximateArea, details, createdAt.
export const REQUEST_TYPES = {
  quick: 'Quick borrow',
  item: 'Item request',
}

// type is 'all', a REQUEST_TYPES key, or 'mine'. 'mine' shows only your own
// requests; every other tab shows only other people's. Newest first.
export const fetchBoardRequests = (type = 'all') =>
  api(`/requests-board?type=${encodeURIComponent(type)}`)

// The tabs the board can show. 'answered' is your own requests that have a response.
export const BOARD_TABS = ['all', ...Object.keys(REQUEST_TYPES), 'mine', 'answered']

// The active tab for a ?tab= value; anything unknown falls back to 'all'.
export const boardTab = (value) => (BOARD_TABS.includes(value) ? value : 'all')

export const answeredRequests = (requests) => requests.filter((request) => request.responses?.length)
