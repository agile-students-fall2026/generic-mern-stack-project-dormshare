// Timing rules for Conversation.jsx, kept separate so they can be tested without a browser.

// After a message is sent, clear the box only if it still holds what was sent, so a
// second message typed while the first was sending is kept.
export const draftAfterSend = (currentDraft, sentDraft) => (currentDraft === sentDraft ? '' : currentDraft)

// Hands out increasing numbers, one per update to the conversation. A slow response
// checks isLatest() before showing itself, so it can't replace a newer update.
export function createUpdateCounter() {
  let latest = 0
  return {
    next: () => ++latest,
    isLatest: (id) => id === latest,
  }
}
