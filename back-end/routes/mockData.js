import { Router } from "express";
import { itemRequestForViewer } from "../services/itemRequests.js";

export const mockDataRouter = Router();

mockDataRouter.get("/mock-data", async (request, response) => {
  const data = await request.app.locals.mockDataStore.load();

  response.json({
    ...data,
    // Other students' responses to item requests are hidden, as on the requests board.
    // The rest of the demo data is still returned in full.
    itemRequests: data.itemRequests.map((item) => itemRequestForViewer(item, request.currentUserId)),
    users: data.users.map((user) => user.id.startsWith("account-")
      ? { id: user.id, name: "DormShare student" }
      : user),
  });
});
