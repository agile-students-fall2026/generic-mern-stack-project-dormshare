import { Router } from "express";

const sameId = (a, b) => String(a) === String(b);
const formatDate = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
  month: "short", day: "numeric", timeZone: "UTC",
});

function generate(data, userId) {
  const titles = new Map(data.listings.map((item) => [item.id, item.title]));
  const names = new Map(data.users.map((user) => [user.id, user.name]));
  const notifications = [];
  const add = (id, title, message, to, category, priority, order) =>
    notifications.push({ id, title, message, to, category, priority, order });

  for (const rental of data.rentals) {
    const owner = sameId(rental.ownerId, userId);
    const borrower = sameId(rental.borrowerId, userId);
    if (!owner && !borrower) continue;

    const item = titles.get(rental.listingId) ?? "an item";
    const otherId = owner ? rental.borrowerId : rental.ownerId;
    const other = names.get(otherId) ?? "Another student";
    const link = `/bookings/${rental.id}`;
    const overdue = rental.status === "active" && rental.endDate < new Date().toISOString().slice(0, 10);
    let event;

    switch (rental.status) {
      case "requested":
        if (owner) event = ["New rental request", `${other} wants to borrow ${item}. Review the request.`, link, 5];
        break;
      case "declined":
        if (borrower) event = ["Rental request declined", `Your request for ${item} was declined.`, link, 2];
        break;
      case "confirmed":
        event = ["Booking confirmed", `Your booking for ${item} is confirmed. Arrange pickup with ${other}.`, link, 3];
        break;
      case "active":
        event = overdue
          ? ["Return overdue", `${item} was due on ${formatDate(rental.endDate)}. Coordinate the return.`, link, 6]
          : ["Return reminder", `${item} is due back on ${formatDate(rental.endDate)}.`, link, 3];
        break;
      case "extension_requested":
        event = owner
          ? ["Extension request received", `${other} wants more time with ${item}. Review the extension.`, `${link}/extension`, 5]
          : ["Extension request pending", `Your extension request for ${item} is waiting for a response.`, `${link}/extension`, 3];
        break;
      case "completed": {
        const reviewed = data.reviews.some((review) =>
          sameId(review.bookingId, rental.id) && sameId(review.reviewerId, userId));
        event = ["Rental completed", reviewed
          ? `Your rental for ${item} is complete.`
          : `Your rental for ${item} is complete. Leave a review.`,
        reviewed ? link : `${link}/review`, 2];
        break;
      }
      case "cancelled":
        event = ["Booking cancelled", `Your booking for ${item} has been cancelled.`, link, 2];
        break;
    }

    if (event) add(`rental-${rental.id}-${overdue ? "overdue" : rental.status}`,
      ...event.slice(0, 3), "Rental", event[3], Number(rental.id));

    const outcome = rental.extensionRequest?.status;
    if (rental.status === "active" && borrower && ["approved", "declined"].includes(outcome)) {
      const approved = outcome === "approved";
      const end = rental.extensionRequest.newEndDate;
      add(`rental-${rental.id}-extension-${outcome}-${end}`,
        approved ? "Extension approved" : "Extension declined",
        approved ? `Your extension for ${item} was approved. New return date: ${formatDate(end)}.`
          : `Your extension request for ${item} was declined.`,
        `${link}/extension`, "Rental", 5, Number(rental.id));
    }
  }

  for (const conversation of data.conversations) {
    if (!conversation.participantIds.some((id) => sameId(id, userId))) continue;
    const last = conversation.messages.at(-1);
    if (!last || sameId(last.senderId, userId)) continue;
    const sender = names.get(last.senderId) ?? "Another student";
    const item = titles.get(conversation.listingId) ?? "an item";
    const offer = last.type === "offer";
    add(`message-${conversation.id}-${last.id}`, offer ? "Offer received" : "New message",
      `${sender} sent ${offer ? "an offer" : "a message"} about ${item}.`,
      `/inbox?conversation=${conversation.id}`, "Message", 4, Number(last.id));
  }

  return notifications.sort((a, b) => b.priority - a.priority || b.order - a.order);
}

export function createNotificationsRouter() {
  const router = Router();
  const readByUser = new Map();
  const readIds = (id) => {
    if (!readByUser.has(id)) readByUser.set(id, new Set());
    return readByUser.get(id);
  };
  const list = async (request) => {
    const data = await request.app.locals.mockDataStore.load();
    const read = readIds(request.currentUserId);
    return generate(data, request.currentUserId).map((item) => ({
      ...item, isRead: read.has(item.id),
    }));
  };

  router.get("/notifications", async (request, response) => {
    response.json(await list(request));
  });

  router.patch("/notifications/:id", async (request, response) => {
    if (typeof request.body?.isRead !== "boolean") {
      return response.status(400).json({ error: "isRead must be a boolean." });
    }
    const item = (await list(request)).find((entry) => entry.id === request.params.id);
    if (!item) return response.status(404).json({ error: "Notification not found." });
    const read = readIds(request.currentUserId);
    if (request.body.isRead) read.add(item.id);
    else read.delete(item.id);
    response.json({ ...item, isRead: request.body.isRead });
  });

  router.post("/notifications/read-all", async (request, response) => {
    const items = await list(request);
    const read = readIds(request.currentUserId);
    for (const item of items) read.add(item.id);
    response.json(items.map((item) => ({ ...item, isRead: true })));
  });

  return router;
}
