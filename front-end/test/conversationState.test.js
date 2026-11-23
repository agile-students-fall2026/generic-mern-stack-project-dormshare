import assert from 'node:assert/strict'
import { test } from 'node:test'
import { setImmediate } from 'node:timers'
import { createUpdateCounter, draftAfterSend, startAutoRefresh } from '../src/pages/chat/conversationState.js'

// Lets pending promise callbacks run, like a refresh finishing.
const settle = () => new Promise((resolve) => setImmediate(resolve))

test('auto-refresh runs every interval until stopped', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const autoRefresh = startAutoRefresh(async () => { calls += 1 }, { interval: 5000 })

  t.mock.timers.tick(4999)
  assert.equal(calls, 0)
  t.mock.timers.tick(1)
  assert.equal(calls, 1)
  await settle()
  t.mock.timers.tick(5000)
  assert.equal(calls, 2)

  autoRefresh.stop()
  await settle()
  t.mock.timers.tick(20000)
  assert.equal(calls, 2)
})

test('auto-refresh never runs two refreshes at once', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  let finish
  const autoRefresh = startAutoRefresh(() => {
    calls += 1
    return new Promise((resolve) => { finish = resolve })
  }, { interval: 5000 })

  t.mock.timers.tick(5000)
  t.mock.timers.tick(5000)
  await autoRefresh.tick()
  assert.equal(calls, 1, 'still waiting on the first refresh')

  finish()
  await settle()
  t.mock.timers.tick(5000)
  assert.equal(calls, 2)
  autoRefresh.stop()
})

test('auto-refresh pauses while the page is hidden and resumes after', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let visible = false
  let calls = 0
  const autoRefresh = startAutoRefresh(async () => { calls += 1 }, { interval: 5000, isVisible: () => visible })

  t.mock.timers.tick(15000)
  assert.equal(calls, 0)

  visible = true
  await autoRefresh.tick()
  assert.equal(calls, 1, 'refreshes right away when the tab is visible again')
  autoRefresh.stop()
})

test('a failed auto-refresh is ignored and the next tick tries again', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const autoRefresh = startAutoRefresh(async () => {
    calls += 1
    if (calls === 1) throw new Error('offline')
  }, { interval: 5000 })

  await autoRefresh.tick()
  await autoRefresh.tick()
  assert.equal(calls, 2)
  autoRefresh.stop()
})

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
