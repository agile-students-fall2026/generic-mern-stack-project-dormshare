import assert from "node:assert/strict";
import { describe, it } from "mocha";
import { createApp } from "../app.js";
import { mockData } from "./fixtures.js";
import { startTestServer } from "./helpers/server.js";

async function withApp(demoLogin, test) {
  const data = mockData();
  const app = createApp({ store: { load: async () => data }, demoLogin });
  const server = await startTestServer(app);
  const request = async (method, path, body, token) => {
    const response = await fetch(`${server.baseUrl}/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  try { await test(request, data, app); }
  finally { await server.close(); }
}

describe("Seeded demo sign-in", () => {
  it("is disabled by default without loading sample data", async () => {
    const app = createApp({ store: { load: () => { throw new Error("Must not load"); } } });
    const server = await startTestServer(app);
    try {
      for (const [path, method] of [["demo-users", "GET"], ["demo-login", "POST"]]) {
        assert.equal((await fetch(`${server.baseUrl}/api/auth/${path}`, { method })).status, 404);
      }
    } finally { await server.close(); }
  });

  it("stays disabled in production even when requested", async () => {
    const original = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      await withApp(true, async (request) => {
        assert.equal((await request("GET", "/auth/demo-users")).status, 404);
        assert.equal((await request("POST", "/auth/demo-login", { userId: "owner-1" })).status, 404);
      });
    } finally {
      if (original === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = original;
    }
  });

  it("lists only seeded users with minimal activity summaries", () => withApp(true, async (request, data) => {
    data.users.push({ id: "account-private", name: "Private student", email: "private@nyu.edu" });
    data.users[0].email = "sample@nyu.edu";
    const result = await request("GET", "/auth/demo-users");
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, [
      { id: "owner-1", displayName: "Item owner", borrowedRentals: 0, conversations: 1 },
      { id: "student-2", displayName: "Item borrower", borrowedRentals: 1, conversations: 1 },
    ]);
    assert.equal(JSON.stringify(result.body).includes("@"), false);
  }));

  it("creates an ordinary session for the selected user's existing records", () => withApp(true, async (request, data, app) => {
    const before = structuredClone(data);
    const signedIn = await request("POST", "/auth/demo-login", { userId: "student-2" });
    assert.equal(signedIn.status, 200);
    assert.match(signedIn.body.token, /^[a-f0-9]{64}$/);
    assert.deepEqual(signedIn.body.user, {
      id: "student-2", email: "", displayName: "Item borrower", campusArea: "",
      emailVerified: false, isDemo: true,
    });
    assert.equal(app.locals.auth.sessions.get(signedIn.body.token), "student-2");
    const me = await request("GET", "/users/me", undefined, signedIn.body.token);
    assert.deepEqual(me.body.user, signedIn.body.user);
    const rentals = await request("GET", "/rentals/mine", undefined, signedIn.body.token);
    assert.deepEqual(rentals.body.map((rental) => rental.id), [101]);
    const chats = await request("GET", "/conversations", undefined, signedIn.body.token);
    assert.deepEqual(chats.body.map((chat) => chat.id), [1]);
    assert.deepEqual(data, before);
    assert.equal(app.locals.auth.credentials.size, 0);
  }));

  it("never signs in registered accounts or unknown identities", () => withApp(true, async (request, data, app) => {
    const signup = await request("POST", "/auth/signup", {
      fullName: "Normal student", email: "normal@nyu.edu", password: "SyntheticPassword123!",
    });
    assert.equal(signup.status, 201);
    for (const userId of [signup.body.user.id, "missing"]) {
      assert.equal((await request("POST", "/auth/demo-login", { userId })).status, 404);
    }
    for (const body of [undefined, {}, { userId: 1 }, { userId: "" }, { userId: ["owner-1"] }]) {
      assert.equal((await request("POST", "/auth/demo-login", body)).status, 400);
    }
    assert.equal(app.locals.auth.sessions.size, 0);
    assert.equal(data.users.find((user) => user.id === signup.body.user.id).emailVerified, false);
  }));

  it("rejects demo profile edits while allowing existing rental and chat actions", () => withApp(true, async (request, data) => {
    const signedIn = await request("POST", "/auth/demo-login", { userId: "owner-1" });
    assert.equal(signedIn.status, 200);
    const token = signedIn.body.token;
    const original = structuredClone(data.users[0]);
    assert.equal((await request("PUT", "/users/me", {
      displayName: "Changed", campusArea: "Library",
    }, token)).status, 403);
    assert.deepEqual(data.users[0], original);
    const sent = await request("POST", "/conversations/1/messages", { text: "Demo test" }, token);
    assert.equal(sent.status, 201);
    assert.equal(sent.body.senderId, "owner-1");
  }));
});
