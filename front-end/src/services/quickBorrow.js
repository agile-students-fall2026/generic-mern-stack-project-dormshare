// Quick Borrow requests are posted to the back-end (#114). The board reads them
// back through requestsBoard.js.
import { api } from './api.js'

// The server sets the ID, requester, status and creation time.
// Throws an ApiError (with the server's message) if the request is rejected.
export const createQuickBorrowRequest = ({
  itemName,
  neededBy,
  neededTime = '',
  borrowDuration,
  approximateArea,
  details,
}) =>
  api('/quick-borrow', {
    method: 'POST',
    body: {
      itemName: itemName.trim(),
      neededBy,
      neededTime,
      borrowDuration: borrowDuration.trim(),
      approximateArea: approximateArea.trim(),
      details: details.trim(),
    },
  })
