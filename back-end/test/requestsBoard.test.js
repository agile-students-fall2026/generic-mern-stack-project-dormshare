import { afterEach, beforeEach, describe, it } from "mocha";
import { expect } from "chai";
import { createApp } from "../app.js";
import { mockData } from "./fixtures.js";
import { startTestServer } from "./helpers/server.js";

// The current user is owner-1 (#88). The fixture has quick request 1 and item request 1 from
// student-2 (others' requests); the tests add quick request 2 and item requests 2-4.
describe("Requests board route (#114)", () => {
  let data;
  let server;

  beforeEach(async () => {
    data = mockData();
    const [item] = data.itemRequests;
    data.quickBorrowRequests.push({
      id: 2, requesterId: "owner-1", itemName: "Screwdriver", neededBy: "2026-11-06",
      approximateArea: "Lobby", details: "20 minutes.", createdAt: "2026-11-05T09:00:00Z",
    });
    data.itemRequests.push(
      { ...item, id: 2, requesterId: "owner-1", itemName: "Fan", createdAt: "2026-11-06T09:00:00Z" },
      { ...item, id: 3, itemName: "Kettle", status: "closed", createdAt: "2026-11-07T09:00:00Z" },
      { ...item, id: 4, itemName: "Iron", createdAt: "2026-11-08T09:00:00Z" },
    );
    server = await startTestServer(createApp({ store: { load: async () => data } }));
  });

  afterEach(async () => { await server?.close(); });

  async function board(query = "") {
    const response = await fetch(`${server.baseUrl}/api/requests-board${query}`);
    return { status: response.status, body: await response.json() };
  }
  const ids = (body) => body.map((request) => `${request.type}-${request.id}`);

  it("lists other people's quick and item requests together, newest first, by default", async () => {
    const { status, body } = await board();

    expect(status).to.equal(200);
    expect(ids(body)).to.deep.equal(["item-4", "quick-1", "item-1"]);
    expect(body[0]).to.include({ itemName: "Iron", type: "item" });
  });

  it("treats ?type=all like no type", async () => {
    expect(ids((await board("?type=all")).body)).to.deep.equal(["item-4", "quick-1", "item-1"]);
  });

  it("?type=quick shows only other people's quick borrow requests", async () => {
    expect(ids((await board("?type=quick")).body)).to.deep.equal(["quick-1"]);
  });

  it("?type=item shows only other people's open item requests", async () => {
    expect(ids((await board("?type=item")).body)).to.deep.equal(["item-4", "item-1"]);
  });

  it("?type=mine shows only the current user's requests", async () => {
    expect(ids((await board("?type=mine")).body)).to.deep.equal(["item-2", "quick-2"]);
  });

  it("shows other people's item requests with only your own responses", async () => {
    const reply = (responderId, conversationId) => ({ responderId, conversationId, messageIds: [conversationId] });
    data.itemRequests.find((item) => item.id === 4).responses = [reply("student-3", 7), reply("owner-1", 8)];
    data.itemRequests.find((item) => item.id === 1).responses = [reply("student-3", 9)];
    const stored = JSON.stringify(data.itemRequests);

    const { body } = await board("?type=item");

    expect(body.find((item) => item.id === 4).responses).to.deep.equal([reply("owner-1", 8)]);
    expect(body.find((item) => item.id === 1).responses).to.deep.equal([]);
    expect(JSON.stringify(data.itemRequests)).to.equal(stored, "the stored requests are not changed");
  });

  it("shows you every response to your own item request", async () => {
    const replies = [
      { responderId: "student-2", conversationId: 7, messageIds: [1] },
      { responderId: "student-3", conversationId: 8, messageIds: [2] },
    ];
    data.itemRequests.find((item) => item.id === 2).responses = replies;

    const { body } = await board("?type=mine");

    expect(body.find((item) => item.id === 2).responses).to.deep.equal(replies);
  });

  it("leaves out closed item requests", async () => {
    const all = (await board()).body.concat((await board("?type=mine")).body);

    expect(ids(all)).to.not.include("item-3");
  });

  it("shows a quick borrow request created through POST /api/quick-borrow as mine", async () => {
    await fetch(`${server.baseUrl}/api/quick-borrow`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        itemName: "Stapler", neededBy: "2026-12-01", borrowDuration: "1 hour",
        approximateArea: "Library", details: "One form.",
      }),
    });

    expect(ids((await board("?type=mine")).body)[0]).to.equal("quick-3");
  });

  it("rejects an unknown type with 400", async () => {
    const { status, body } = await board("?type=bogus");

    expect(status).to.equal(400);
    expect(body.error).to.include("type must be one of");
  });

  it("returns an empty list when there are no requests", async () => {
    data.quickBorrowRequests = [];
    data.itemRequests = [];

    expect(await board()).to.deep.equal({ status: 200, body: [] });
  });
});
