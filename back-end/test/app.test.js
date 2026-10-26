import { after, before, describe, it } from "mocha";
import { expect } from "chai";
import { app } from "../app.js";

describe("GET /api/health", () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    if (!server?.listening) return;

    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("returns an OK status as JSON", async () => {
    const response = await fetch(`${baseUrl}/api/health`);

    expect(response.status).to.equal(200);
    expect(response.headers.get("content-type")).to.contain("application/json");
    expect(await response.json()).to.deep.equal({ status: "ok" });
  });
});
