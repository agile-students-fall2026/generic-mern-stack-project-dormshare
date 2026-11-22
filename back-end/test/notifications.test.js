import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import { createApp } from "../app.js";
import { mockData } from "./fixtures.js";
import { startTestServer } from "./helpers/server.js";

describe("Notifications API (#101)", () => {
  let data;
  let app;
  let server;
  const token = "a".repeat(64);

  beforeEach(async () => {
    data = mockData();
    app = createApp({ store: { load: async () => data } });
    app.locals.auth.sessions.set(token, "student-2");
    server = await startTestServer(app);
  });

  afterEach(async () => { await server?.close(); });

  async function request(method, path, body, auth) {
    const response = await fetch(`${server.baseUrl}/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        ...(auth ? { authorization: `Bearer ${auth}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }

  it("returns only current user's rental and message notifications", async () => {
    const owner = await request("GET", "/notifications");
    const student = await request("GET", "/notifications", undefined, token);
    expect(owner.status).to.equal(200);
    expect(owner.body.find((n) => n.id === "rental-101-completed")).to.include({
      to: "/bookings/101/review", isRead: false,
    });
    expect(owner.body.some((n) => n.category === "Message")).to.equal(false);
    expect(student.body.find((n) => n.id === "message-1-1")).to.include({
      to: "/inbox?conversation=1", category: "Message", isRead: false,
    });
    expect(student.body.find((n) => n.id === "rental-101-completed").to)
      .to.equal("/bookings/101");
  });

  it("marks notifications read/unread independently for each user", async () => {
    const path = "/notifications/rental-101-completed";
    expect(await request("PATCH", path, { isRead: true })).to.include({ status: 200 });
    expect((await request("GET", "/notifications")).body[0].isRead).to.equal(true);
    expect((await request("GET", "/notifications", undefined, token)).body
      .find((n) => n.id === "rental-101-completed").isRead).to.equal(false);
    expect((await request("PATCH", path, { isRead: false })).body.isRead).to.equal(false);
  });

  it("validates writes and rejects unknown or inaccessible notification IDs", async () => {
    for (const body of [undefined, {}, { isRead: "true" }, { isRead: null }]) {
      expect((await request("PATCH", "/notifications/rental-101-completed", body)).status).to.equal(400);
    }
    expect((await request("PATCH", "/notifications/unknown", { isRead: true })).status).to.equal(404);
    expect((await request("PATCH", "/notifications/message-1-1", { isRead: true })).status).to.equal(404);
    expect((await request("GET", "/notifications", undefined, "b".repeat(64))).status).to.equal(401);
  });

  it("marks all current events read; a new status creates an unread event", async () => {
    const result = await request("POST", "/notifications/read-all");
    expect(result.status).to.equal(200);
    expect(result.body.every((n) => n.isRead)).to.equal(true);
    data.rentals[0].status = "confirmed";
    const fresh = (await request("GET", "/notifications")).body;
    expect(fresh.find((n) => n.id === "rental-101-confirmed").isRead).to.equal(false);
    expect(fresh.some((n) => n.id === "rental-101-completed")).to.equal(false);
  });

  it("includes borrower-only extension outcomes and overdue alerts", async () => {
    data.rentals[0].status = "active";
    data.rentals[0].endDate = "2000-01-01";
    data.rentals[0].extensionRequest = { status: "approved", newEndDate: "2099-01-02" };
    const owner = (await request("GET", "/notifications")).body;
    const borrower = (await request("GET", "/notifications", undefined, token)).body;
    expect(owner.find((n) => n.id === "rental-101-overdue").title).to.equal("Return overdue");
    expect(owner.some((n) => n.title === "Extension approved")).to.equal(false);
    expect(borrower.find((n) => n.id === "rental-101-extension-approved-2099-01-02").to)
      .to.equal("/bookings/101/extension");
  });
});
