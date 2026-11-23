import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createAuthSession } from '../src/context/authSession.js'
import { api, setSessionToken } from '../src/services/api.js'
import { CURRENT_USER_ID, setCurrentUserId } from '../src/services/mockDataService.js'

const demoUser = {
  id: 'student-2', email: '', displayName: 'Sample borrower', campusArea: '',
  emailVerified: false, isDemo: true,
}
const account = {
  id: 'account-student', email: 'student@nyu.edu', displayName: 'Student',
  campusArea: 'Third North', emailVerified: true,
}

function setup(t) {
  let user = null
  let pending = null
  setSessionToken(null)
  setCurrentUserId(null)
  t.after(() => { setSessionToken(null); setCurrentUserId(null) })
  const actions = createAuthSession({
    onCurrentUser(value) { user = value },
    onPendingSignup(value) { pending = value },
  })
  return { actions, get user() { return user }, get pending() { return pending } }
}

test('demo sign-in uses the seeded ID and installs a normal bearer session', async (t) => {
  const state = setup(t)
  setSessionToken('older-session')
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/demo-login') {
      assert.deepEqual(JSON.parse(options.body), { userId: 'student-2' })
      assert.equal(options.headers.Authorization, undefined)
      return Response.json({ token: 'sample-session', user: demoUser })
    }
    assert.equal(options.headers.Authorization, 'Bearer sample-session')
    return Response.json({ user: demoUser })
  })

  assert.deepEqual(await state.actions.signInDemo('student-2'), demoUser)
  assert.deepEqual(state.user, demoUser)
  assert.equal(CURRENT_USER_ID, 'student-2')
  assert.equal(state.pending, null)
  await api('/users/me')
})

test('a rejected demo sign-in does not install a user', async (t) => {
  const state = setup(t)
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Demo access is unavailable.' }, { status: 404 }))
  await assert.rejects(state.actions.signInDemo('student-2'), {
    status: 404, message: 'Demo access is unavailable.',
  })
  assert.equal(state.user, null)
})

test('sign-out prevents a late demo sign-in from restoring its session', async (t) => {
  const state = setup(t)
  let release
  const waiting = new Promise((resolve) => { release = resolve })
  t.mock.method(globalThis, 'fetch', async (url) => {
    if (url === '/api/auth/demo-login') return waiting
    return Response.json({ user: demoUser })
  })

  const signingIn = state.actions.signInDemo('student-2')
  state.actions.signOut()
  release(Response.json({ token: 'sample-session', user: demoUser }))
  await assert.rejects(signingIn, /Session changed/)
  assert.equal(state.user, null)
  assert.equal(CURRENT_USER_ID, 'owner-1')
})

test('a newer normal sign-in wins over a late demo sign-in', async (t) => {
  const state = setup(t)
  let release
  const waiting = new Promise((resolve) => { release = resolve })
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === '/api/auth/demo-login') return waiting
    if (url === '/api/auth/login') return Response.json({ token: 'account-session' })
    const user = options.headers.Authorization === 'Bearer account-session' ? account : demoUser
    return Response.json({ user })
  })

  const oldSignIn = state.actions.signInDemo('student-2')
  await state.actions.signIn(account.email, 'Synthetic password')
  release(Response.json({ token: 'sample-session' }))
  await assert.rejects(oldSignIn, /Session changed/)
  assert.deepEqual(state.user, account)
  assert.equal(CURRENT_USER_ID, account.id)
})

test('a newer demo sign-in survives an older password reset completion', async (t) => {
  const state = setup(t)
  const finishReset = state.actions.prepareResetSignOut(account.email)
  t.mock.method(globalThis, 'fetch', async (url) =>
    Response.json(url === '/api/auth/demo-login'
      ? { token: 'sample-session' }
      : { user: demoUser }))

  await state.actions.signInDemo('student-2')
  finishReset()
  assert.deepEqual(state.user, demoUser)
  assert.equal(CURRENT_USER_ID, 'student-2')
})
