// Chat and offer requests to the back-end (#104). Every conversation the API returns
// is also copied into the shared conversation cache, so pages that still read it
// synchronously (item request cards, reports, notifications) see the change.
// The route contracts are documented in back-end/README.md.
import { api } from './api.js'
import { cacheConversation, cacheConversations, cacheRentals, getConversations } from './mockDataService.js'

const path = (id) => `/conversations/${encodeURIComponent(id)}`
const sameId = (a, b) => String(a) === String(b)

// After a successful change, reload the conversation to pick up side effects. If only
// the reload fails, the change still happened on the server, so apply it to the cached
// copy instead of reporting an error (which would invite sending it twice).
async function reloadAfterChange(id, applyLocally) {
  try {
    return await fetchConversation(id)
  } catch (error) {
    const cached = getConversations().find((conversation) => sameId(conversation.id, id))
    if (!cached) throw error
    return cacheConversation(applyLocally(cached))
  }
}

const replaceMessage = (conversation, updated) => ({
  ...conversation,
  messages: conversation.messages.map((message) => (sameId(message.id, updated.id) ? updated : message)),
})

// The current user's conversations, newest message first.
export async function fetchConversations() {
  return cacheConversations(await api('/conversations'))
}

export async function fetchConversation(id) {
  return cacheConversation(await api(path(id)))
}

// Opens (or reopens) the chat with another student about a listing, so "Message owner"
// and "Message borrower" buttons land in a real conversation. Text is optional.
export async function startConversation({ listingId, participantId, text }) {
  return cacheConversation(await api('/conversations', {
    method: 'POST',
    body: { listingId: Number(listingId), participantId, text },
  }))
}

// The routes below return only the new or changed message, which is also what
// reloadAfterChange applies locally if the reload fails.
export async function sendChatMessage(id, text) {
  const message = await api(`${path(id)}/messages`, { method: 'POST', body: { text } })
  return reloadAfterChange(id, (conversation) => ({ ...conversation, messages: [...conversation.messages, message] }))
}

// A new offer marks any pending offer as countered, matching the server.
export async function sendChatOffer(id, { totalPrice, startDate, endDate }) {
  const offer = await api(`${path(id)}/offers`, { method: 'POST', body: { totalPrice, startDate, endDate } })
  return reloadAfterChange(id, (conversation) => ({
    ...conversation,
    messages: [
      ...conversation.messages.map((message) =>
        message.type === 'offer' && message.status === 'pending' ? { ...message, status: 'countered' } : message),
      offer,
    ],
  }))
}

export async function declineChatOffer(id, messageId) {
  const offer = await api(`${path(id)}/offers/${encodeURIComponent(messageId)}/decline`, { method: 'POST' })
  return reloadAfterChange(id, (conversation) => replaceMessage(conversation, offer))
}

// Accepting creates a confirmed booking on the server, so the booking pages can load it.
export async function acceptChatOffer(id, messageId) {
  const { offer, booking } = await api(`${path(id)}/offers/${encodeURIComponent(messageId)}/accept`, { method: 'POST' })
  cacheRentals([booking])
  await reloadAfterChange(id, (conversation) => replaceMessage(conversation, offer))
  return booking
}
