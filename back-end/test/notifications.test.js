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
    expect((await request("GET", "/notifications")).body
      .find((n) => n.id === "rental-101-completed").isRead).to.equal(true);
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
    expect(owner.find((n) => n.id === "rental-101-overdue-2000-01-01").title).to.equal("Return overdue");
    expect(owner.some((n) => n.title === "Extension approved")).to.equal(false);
    expect(borrower.find((n) => n.id === "rental-101-extension-approved-2099-01-02").to)
      .to.equal("/bookings/101/extension");
  });

  it("keeps a repeated extension request unread after the first was declined", async () => {
    const rental = data.rentals[0];
    rental.status = "active";
    rental.endDate = "2099-01-01";
    rental.extensionRequest = null;

    expect((await request("POST", "/bookings/101/extensions",
      { newEndDate: "2099-01-03" }, token)).status).to.equal(201);

    const first = (await request("GET", "/notifications")).body
      .find((n) => n.title === "Extension request received");
    expect(first).to.exist;
    expect((await request("PATCH", `/notifications/${first.id}`,
      { isRead: true })).status).to.equal(200);

    expect((await request("PATCH", "/bookings/101/extensions",
      { approve: false })).status).to.equal(200);

    expect((await request("POST", "/bookings/101/extensions",
      { newEndDate: "2099-01-05" }, token)).status).to.equal(201);

    const second = (await request("GET", "/notifications")).body
      .find((n) => n.title === "Extension request received");
    expect(second).to.exist;
    expect(second.id).not.to.equal(first.id);
    expect(second.isRead).to.equal(false);
  });

  it("sorts equal-priority events by timestamps instead of unrelated IDs", async () => {
    const original = data.rentals[0];
    data.rentals.push(
      { ...original, id: 502, status: "requested", createdAt: "2026-01-01" },
      { ...original, id: 501, status: "requested", createdAt: "2026-12-01" },
    );

    const owner = (await request("GET", "/notifications")).body;
    expect(owner.filter((n) => n.title === "New rental request").map((n) => n.id))
      .to.deep.equal(["rental-501-requested", "rental-502-requested"]);
    expect(owner.find((n) => n.id === "rental-501-requested").createdAt)
      .to.equal("2026-12-01");

    const conversation = data.conversations[0];
    const originalMessage = conversation.messages[0];
    data.conversations.push(
      { ...conversation, id: 2, messages: [
        { ...originalMessage, id: 99, sentAt: "2025-01-01T09:00:00Z" },
      ] },
      { ...conversation, id: 3, messages: [
        { ...originalMessage, id: 1, sentAt: "2026-12-01T09:00:00Z" },
      ] },
    );

    const student = (await request("GET", "/notifications", undefined, token)).body;
    const messages = student.filter((n) => n.category === "Message");
    expect(messages.map((n) => n.id))
      .to.deep.equal(["message-3-1", "message-1-1", "message-2-99"]);
    expect(messages[0].createdAt).to.equal("2026-12-01T09:00:00Z");
  });

  it("shows overdue and extension notifications together without duplicate IDs", async () => {
    const rental = data.rentals[0];
    rental.status = "extension_requested";
    rental.endDate = "2000-01-01";
    rental.extensionRequest = {
      status: "pending",
      newEndDate: "2099-01-05",
    };

    const owner = (await request("GET", "/notifications")).body;

    expect(owner.filter((n) => n.id === "rental-101-overdue-2000-01-01"))
      .to.have.length(1);
    expect(owner.some((n) => n.title === "Extension request received"))
      .to.equal(true);
    expect(new Set(owner.map((n) => n.id)).size).to.equal(owner.length);

    const borrower = (await request("GET", "/notifications", undefined, token)).body;
    expect(borrower.some((n) => n.title === "Return overdue")).to.equal(true);
    expect(borrower.some((n) => n.title === "Extension request pending"))
      .to.equal(true);

    rental.status = "active";
    rental.extensionRequest.status = "declined";

    const afterDecline = (await request("GET", "/notifications")).body;
    expect(afterDecline.filter((n) => n.id === "rental-101-overdue-2000-01-01"))
      .to.have.length(1);
    expect(afterDecline.some((n) => n.title === "Extension request received"))
      .to.equal(false);
  });

  it("uses role-specific wording and handles malformed return dates", async () => {
    const rental = data.rentals[0];

    const ownerCompleted = (await request("GET", "/notifications")).body
      .find((n) => n.title === "Rental completed");
    const borrowerCompleted = (await request("GET", "/notifications", undefined, token)).body
      .find((n) => n.title === "Rental completed");

    expect(ownerCompleted.message).to.include("to Item borrower");
    expect(borrowerCompleted.message).to.include("from Item owner");

    rental.status = "confirmed";

    const ownerConfirmed = (await request("GET", "/notifications")).body
      .find((n) => n.title === "Booking confirmed");
    const borrowerConfirmed = (await request("GET", "/notifications", undefined, token)).body
      .find((n) => n.title === "Booking confirmed");

    expect(ownerConfirmed.message).to.include("You confirmed");
    expect(borrowerConfirmed.message).to.include("Your booking");

    rental.status = "active";

    for (const endDate of [undefined, "2026-02-30", "invalid"]) {
      rental.endDate = endDate;
      const items = (await request("GET", "/notifications")).body;
      expect(items.some((n) => n.message.includes("Invalid Date"))).to.equal(false);
      expect(items.some((n) => n.message.includes("a date not yet available")))
        .to.equal(true);
    }
  });

  it("mark-all-read leaves another user's notifications unchanged", async () => {
    const before = (await request("GET", "/notifications", undefined, token)).body;
    expect(before.some((n) => !n.isRead)).to.equal(true);

    const result = await request("POST", "/notifications/read-all");
    expect(result.status).to.equal(200);
    expect(result.body.every((n) => n.isRead)).to.equal(true);

    const after = (await request("GET", "/notifications", undefined, token)).body;
    expect(after).to.deep.equal(before);
  });

  it("does not notify the sender of their own latest message", async () => {
    data.conversations[0].messages.push({
      id: 2,
      senderId: "student-2",
      type: "text",
      text: "Thanks!",
      sentAt: "2026-11-20T10:00:00Z",
    });

    const sender = (await request("GET", "/notifications", undefined, token)).body;
    expect(sender.some((n) => n.category === "Message")).to.equal(false);

    const recipient = (await request("GET", "/notifications")).body;
    expect(recipient.find((n) => n.id === "message-1-2")).to.include({
      category: "Message",
      isRead: false,
    });
  });

  it("keeps repeated extension outcomes unread even for the same date", async () => {
    const rental = data.rentals[0];
    rental.status = "active";
    rental.endDate = "2099-01-01";
    rental.extensionRequest = null;

    async function requestAndDecline() {
      expect((await request("POST", "/bookings/101/extensions",
        { newEndDate: "2099-01-03" }, token)).status).to.equal(201);
      expect((await request("PATCH", "/bookings/101/extensions",
        { approve: false })).status).to.equal(200);
    }

    await requestAndDecline();

    const first = (await request("GET", "/notifications", undefined, token)).body
      .find((n) => n.title === "Extension declined");

    expect(first).to.exist;
    expect((await request("PATCH", `/notifications/${first.id}`,
      { isRead: true }, token)).status).to.equal(200);

    await requestAndDecline();

    const second = (await request("GET", "/notifications", undefined, token)).body
      .find((n) => n.title === "Extension declined");

    expect(second).to.exist;
    expect(second.id).not.to.equal(first.id);
    expect(second.isRead).to.equal(false);
  });

  it("creates a fresh overdue alert for a newly missed extended deadline", async () => {
    const RealDate = globalThis.Date;
    let now = "2026-01-02T12:00:00Z";

    globalThis.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return RealDate.parse(now);
      }
    };

    try {
      const rental = data.rentals[0];
      rental.status = "active";
      rental.endDate = "2026-01-01";
      rental.extensionRequest = null;

      const firstId = "rental-101-overdue-2026-01-01";
      const secondId = "rental-101-overdue-2026-01-03";

      const first = (await request("GET", "/notifications")).body
        .find((n) => n.id === firstId);

      expect(first).to.exist;
      expect(first.isRead).to.equal(false);

      expect((await request("PATCH", `/notifications/${firstId}`,
        { isRead: true })).status).to.equal(200);

      // A pending extension must preserve the original overdue alert.
      expect((await request("POST", "/bookings/101/extensions",
        { newEndDate: "2026-01-03" }, token)).status).to.equal(201);

      const pending = (await request("GET", "/notifications")).body;
      expect(pending.find((n) => n.id === firstId).isRead).to.equal(true);

      // Approval moves the deadline and removes the old overdue alert.
      expect((await request("PATCH", "/bookings/101/extensions",
        { approve: true })).status).to.equal(200);

      expect(rental.endDate).to.equal("2026-01-03");

      const afterApproval = (await request("GET", "/notifications")).body;
      expect(afterApproval.some((n) => n.id === firstId)).to.equal(false);

      // The approved deadline passes.
      now = "2026-01-04T12:00:00Z";

      const second = (await request("GET", "/notifications")).body
        .find((n) => n.id === secondId);

      expect(second).to.exist;
      expect(second.isRead).to.equal(false);
      expect(second.id).not.to.equal(firstId);

      // The same overdue deadline must not generate a new ID daily.
      expect((await request("PATCH", `/notifications/${secondId}`,
        { isRead: true })).status).to.equal(200);

      now = "2026-01-05T12:00:00Z";

      const nextDay = (await request("GET", "/notifications")).body
        .find((n) => n.id === secondId);

      expect(nextDay).to.exist;
      expect(nextDay.isRead).to.equal(true);
    } finally {
      globalThis.Date = RealDate;
    }
  });
});
