import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createUpdateCounter, draftAfterSend } from '../src/pages/chat/conversationState.js'

test('clears the message box when it still holds the sent message', () => {
  assert.equal(draftAfterSend('On my way.', 'On my way.'), '')
})

test('keeps a second message typed while the first was sending', () => {
  assert.equal(draftAfterSend('Running late', 'On my way.'), 'Running late')
})

test('only the latest update counts as current', () => {
  const updates = createUpdateCounter()
  const first = updates.next()
  assert.equal(updates.isLatest(first), true)
  const second = updates.next()
  assert.equal(updates.isLatest(first), false)
  assert.equal(updates.isLatest(second), true)
})

// Replays the race from review: an action fails and starts a refresh, a retry succeeds,
// and then the slow refresh returns with the older conversation.
test('a slow refresh after an error cannot replace a successful retry', async () => {
  const updates = createUpdateCounter()
  let shown = ['Hello']
  const show = (messages) => {
    updates.next()
    shown = messages
  }

  let finishRefresh
  const refresh = updates.next()
  const slowRefresh = new Promise((resolve) => { finishRefresh = resolve })
    .then((messages) => { if (updates.isLatest(refresh)) shown = messages })

  show(['Hello', 'Retry worked'])
  finishRefresh(['Hello'])
  await slowRefresh

  assert.deepEqual(shown, ['Hello', 'Retry worked'])
})

test('a refresh with nothing newer is still shown', async () => {
  const updates = createUpdateCounter()
  let shown = ['Old offer pending']
  const refresh = updates.next()
  await Promise.resolve(['Offer countered']).then((messages) => {
    if (updates.isLatest(refresh)) shown = messages
  })
  assert.deepEqual(shown, ['Offer countered'])
})
