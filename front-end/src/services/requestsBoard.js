// Shared requests board service. The board loads one list of Quick Borrow and
// item requests from the back-end (#114) instead of reading each source itself.
import { api } from './api.js'
import { CURRENT_USER_ID, getLocalItemRequests } from './mockDataService.js'

// Item requests use the same field names as quick borrow requests at a minimum:
// id, itemName, neededBy, approximateArea, details, createdAt.
export const REQUEST_TYPES = {
  quick: 'Quick borrow',
  item: 'Item request',
}

// Item requests posted in this browser aren't on the server yet (there is no route
// to create them), so they are added to the board here. Remove once item requests
// are saved through the API.
function localItemRequests(type) {
  if (type === 'quick') return []
  const isMine = (request) => String(request.requesterId) === String(CURRENT_USER_ID)
  return getLocalItemRequests()
    .filter((request) => request.status === 'open' && (type === 'mine' ? isMine(request) : !isMine(request)))
    .map((request) => ({ ...request, type: 'item' }))
}

// type is 'all', a REQUEST_TYPES key, or 'mine'. 'mine' shows only your own
// requests; every other tab shows only other people's. Newest first.
export async function fetchBoardRequests(type = 'all') {
  const fetched = await api(`/requests-board?type=${encodeURIComponent(type)}`)
  const known = new Set(fetched.filter((request) => request.type === 'item').map((request) => String(request.id)))
  const local = localItemRequests(type).filter((request) => !known.has(String(request.id)))

  return [...fetched, ...local].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
