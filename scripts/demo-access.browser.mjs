// Build the frontend first. PLAYWRIGHT_MODULE may point to an external installation.
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import { createApp } from '../back-end/app.js'
import { mockResponse } from '../front-end/test/fixtures.js'

const playwright = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const engine = process.env.PLAYWRIGHT_BROWSER || 'chromium'
const placeholder = '/listing-images/placeholder.png'

async function fixture(t, { enabled = true } = {}) {
  const data = mockResponse()
  data.listings[0].image = 'https://images.example.test/lamp.svg'
  data.listings[1].image = 'https://images.example.test/broken.jpg'
  const app = createApp({ store: { load: async () => data }, demoLogin: enabled })
  const server = app.listen(0, '127.0.0.1')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  await once(server, 'listening')
  const origin = `http://127.0.0.1:${server.address().port}`
  const browser = await playwright[engine].launch({ headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.setDefaultTimeout(6000)
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  t.after(() => assert.deepEqual(errors, []))
  await page.route('https://images.example.test/**', (route) => route.request().url().endsWith('lamp.svg')
    ? route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="purple"/></svg>' })
    : route.fulfill({ status: 404, body: '' }))
  async function go(path) {
    await page.evaluate((path) => {
      history.pushState({}, '', path)
      dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }
  return { page, data, origin, go }
}

test('listing photos use the supplied source and broken photos fall back once', async (t) => {
  const { page, origin } = await fixture(t)
  await page.goto(`${origin}/browse`)
  const lamp = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Desk lamp', exact: true }) })
  const projector = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Projector', exact: true }) })
  await lamp.waitFor()
  await lamp.getByRole('img').evaluate((image) => image.decode())
  assert.equal(await lamp.getByRole('img').getAttribute('src'), 'https://images.example.test/lamp.svg')
  await projector.scrollIntoViewIfNeeded()
  await page.waitForFunction(() => [...document.querySelectorAll('.ds-listing-card img')]
    .some((image) => image.alt === 'Projector' && image.getAttribute('src') === '/listing-images/placeholder.png' && image.naturalWidth > 0))
  await lamp.getByRole('link', { name: 'Desk lamp', exact: true }).click()
  await page.getByRole('heading', { name: 'Desk lamp', exact: true }).waitFor()
  assert.equal(await page.getByRole('img', { name: 'Desk lamp', exact: true }).getAttribute('src'), 'https://images.example.test/lamp.svg')

  // Even a failed placeholder must not cause an onError request loop.
  const failingPage = await page.context().browser().newPage()
  let failures = 0
  await failingPage.route('https://images.example.test/**', (route) => route.fulfill({ status: 404, body: '' }))
  await failingPage.route(`**${placeholder}`, (route) => { failures += 1; return route.fulfill({ status: 404, body: '' }) })
  await failingPage.goto(`${origin}/browse/2`)
  const image = failingPage.getByRole('img', { name: 'Projector', exact: true })
  await image.waitFor()
  await failingPage.waitForFunction(() => {
    const image = document.querySelector('img[alt="Projector"]')
    return image?.getAttribute('src') === '/listing-images/placeholder.png' && image.complete
  })
  assert.equal(failures, 1)
})

test('demo sign-in opens seeded rentals, messages, profile and another sample user', async (t) => {
  const { page, origin, go } = await fixture(t)
  await page.goto(`${origin}/login`)
  await page.getByRole('heading', { name: 'Try a demo account', exact: true }).waitFor()
  await page.getByLabel('Sample user', { exact: true }).selectOption('owner-1')
  await page.getByRole('button', { name: 'Sign in to demo', exact: true }).click()
  await page.waitForURL('**/browse')
  await go('/renter-dashboard')
  await page.getByText('2 rentals found', { exact: true }).waitFor()
  await go('/inbox')
  await page.getByRole('heading', { name: 'Messages', exact: true }).waitFor()
  await page.locator('.chat-card').first().waitFor()
  await go('/profile')
  await page.getByRole('heading', { name: 'Online owner', exact: true }).waitFor()
  await page.getByText('Sample account', { exact: true }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Edit profile', exact: true }).count(), 0)
  await go('/setup-profile')
  await page.waitForURL('**/profile')
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/' || url.pathname === '/login')
  await go('/login')
  await page.getByLabel('Sample user', { exact: true }).selectOption('student-2')
  await page.getByRole('button', { name: 'Sign in to demo', exact: true }).click()
  await page.waitForURL('**/browse')
  await go('/profile')
  await page.getByRole('heading', { name: 'Online borrower', exact: true }).waitFor()
})

test('demo loading and sign-in failures retry, with normal sign-in blocked while pending', async (t) => {
  const { page, origin } = await fixture(t)
  let failLoad = true
  await page.route('**/api/auth/demo-users', (route) => failLoad
    ? route.fulfill({ status: 503, json: { error: 'Synthetic outage.' } }) : route.continue())
  await page.goto(`${origin}/login`)
  await page.getByRole('alert').filter({ hasText: 'Could not load demo accounts.' }).waitFor()
  failLoad = false
  await page.getByRole('button', { name: 'Try again', exact: true }).click()
  await page.getByLabel('Sample user', { exact: true }).waitFor()
  let failLogin = true
  let release
  const waiting = new Promise((resolve) => { release = resolve })
  await page.route('**/api/auth/demo-login', async (route) => {
    if (failLogin) return route.fulfill({ status: 503, json: { error: 'Synthetic sign-in failure.' } })
    await waiting
    return route.continue()
  })
  await page.getByRole('button', { name: 'Sign in to demo', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'Synthetic sign-in failure.' }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isEnabled(), true)
  failLogin = false
  await page.getByRole('button', { name: 'Sign in to demo', exact: true }).click()
  await page.getByRole('button', { name: 'Opening demo...', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).isDisabled(), true)
  assert.equal(await page.getByLabel('NYU email', { exact: true }).isDisabled(), true)
  release()
  await page.waitForURL('**/browse')
})

test('disabled demo access hides the selector and normal password login still works', async (t) => {
  const { page, origin, data } = await fixture(t, { enabled: false })
  async function post(path, body) {
    const result = await fetch(`${origin}/api${path}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    assert.ok(result.ok)
    return result.json()
  }
  const email = 'normal-browser@nyu.edu'
  const password = 'Synthetic password123!'
  const signup = await post('/auth/signup', { fullName: 'Normal Browser', email, password })
  await post('/auth/verify', { email, code: signup.demoCode })
  data.users.find((user) => user.id === signup.user.id).campusArea = 'Third North'
  const availability = page.waitForResponse('**/api/auth/demo-users')
  await page.goto(`${origin}/login`)
  assert.equal((await availability).status(), 404)
  await page.waitForFunction(() => !document.querySelector('#demo-login-heading'))
  await page.getByLabel('NYU email', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.waitForURL('**/browse')
})

test('demo selector and supplied images fit narrow and desktop viewports', async (t) => {
  const { page, origin, go } = await fixture(t)
  await page.goto(`${origin}/login`)
  await page.getByLabel('Sample user', { exact: true }).waitFor()
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
  await go('/browse')
  await page.getByRole('heading', { name: 'Browse items', exact: true }).waitFor()
  for (const width of [320, 390, 1366]) {
    await page.setViewportSize({ width, height: 844 })
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  }
})
