# Listing images and sample-user access

## Requested behavior

Show the image supplied by each Mockaroo listing. Let testers sign in as a
seeded Mockaroo user to use that user's existing rentals and conversations.
Newly registered accounts continue to use normal sign-in and start empty.

## Images

Keep `listingImage(id)` as the shared lookup. Accept an HTTPS image URL or a
local listing-image path. Missing or unsupported sources use the existing
placeholder. A shared `ListingImage` component handles failed image requests
without a retry loop. Use it on browse, details, bookings, listings, and chat.
Do not invent images, change provider URLs, or add an image service.

## Demo access

The Sign in page gets a separate, clearly labeled sample-user selector.
Options show the sample name and counts of borrowed rentals and conversations.
Sign-in opens Browse and uses the normal bearer-session flow with the selected
user's existing ID. No records are copied to registered accounts.

Enable the feature only through `DEMO_LOGIN_ENABLED=true` in the private backend
environment. It is off by default and always disabled when `NODE_ENV=production`.
No frontend environment file is needed.

`GET /api/auth/demo-users` lists minimal seeded-user summaries.
`POST /api/auth/demo-login` accepts `{ userId }` and creates a normal session.
Both return 404 when disabled. Demo access rejects all `account-*` identities,
including registered users, unknown IDs, and malformed input. Normal email and
password sign-in keeps its current behavior and stale-response protections.

Demo profiles use the sample name and an explicit `isDemo` marker. They do not
invent an email address or claim email verification. Hide profile editing for
demo users and reject profile updates on the server. Testers can still change
sample rentals, requests, listings, and conversations through existing actions.
Sample state remains in memory and resets with the backend.

## Implementation and checks

1. Add image lookup tests, observe failure, implement shared lookup/fallback,
   and check each current image consumer. Commit this independent change.
2. Add backend tests for feature gating, registered-user exclusion, sessions,
   data ownership, and profile protection. Implement the routes and config.
3. Add session integration and late-response tests. Add the sample-user selector
   using existing form styles, error/retry states, and pending controls.
4. Run both test suites, lint, build, browser image/fallback and sample-account
   flows. Review correctness and security independently before publishing.
5. Enable the setting in the existing private backend file only. Keep all
   credentials private and update setup documentation.

No dependency changes, persistent storage, upload feature, or automatic merge.
