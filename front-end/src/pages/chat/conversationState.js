// Timing rules for Conversation.jsx, kept separate so they can be tested without a browser.

// After a message is sent, clear the box only if it still holds what was sent, so a
// second message typed while the first was sending is kept.
export const draftAfterSend = (currentDraft, sentDraft) => (currentDraft === sentDraft ? '' : currentDraft)

// Calls refresh every `interval` ms while isVisible() says the page can be seen, and
// never starts a second refresh while one is still running. A failed refresh is ignored;
// the next tick tries again. tick() can also be called directly, e.g. when the tab
// becomes visible again. Call stop() to end it.
export function startAutoRefresh(refresh, { interval = 5000, isVisible = () => true } = {}) {
  let running = false
  const tick = async () => {
    if (running || !isVisible()) return
    running = true
    try {
      await refresh()
    } catch {
      // Keep what is on screen; the next tick tries again.
    } finally {
      running = false
    }
  }
  const timer = setInterval(tick, interval)
  return { tick, stop: () => clearInterval(timer) }
}

// Hands out increasing numbers, one per update to the conversation. A slow response
// checks isLatest() before showing itself, so it can't replace a newer update.
export function createUpdateCounter() {
  let latest = 0
  return {
    next: () => ++latest,
    isLatest: (id) => id === latest,
  }
}
