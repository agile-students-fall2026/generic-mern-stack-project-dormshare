import { Router } from "express";

const sameId = (a, b) => String(a) === String(b);
const formatDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "a date not yet available";
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return "a date not yet available";
  }
  return date.toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "UTC",
  });
};

function generate(data, userId) {
  const titles = new Map(data.listings.map((item) => [item.id, item.title]));
  const names = new Map(data.users.map((user) => [user.id, user.name]));
  const notifications = [];
  const today = new Date().toLocaleDateString("en-CA");
  const add = (id, title, message, to, category, priority, createdAt) =>
    notifications.push({ id, title, message, to, category, priority, createdAt });

  for (const rental of data.rentals) {
    const owner = sameId(rental.ownerId, userId);
    const borrower = sameId(rental.borrowerId, userId);
    if (!owner && !borrower) continue;

    const item = titles.get(rental.listingId) ?? "an item";
    const otherId = owner ? rental.borrowerId : rental.ownerId;
    const other = names.get(otherId) ?? "Another student";
    const link = `/bookings/${rental.id}`;
    const overdue = ["active", "extension_requested"].includes(rental.status) &&
      rental.endDate < today;
    let event;

    switch (rental.status) {
      case "requested":
        if (owner) event = ["New rental request", `${other} wants to borrow ${item}. Review the request.`, link, 5];
        break;
      case "declined":
        if (borrower) event = ["Rental request declined", `Your request for ${item} was declined.`, link, 2];
        break;
      case "confirmed":
        event = ["Booking confirmed", owner
          ? `You confirmed ${other}'s request for ${item}. Arrange pickup.`
          : `Your booking for ${item} is confirmed. Arrange pickup with ${other}.`, link, 3];
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
        const completion = owner
          ? `The rental of ${item} to ${other} is complete.`
          : `Your rental of ${item} from ${other} is complete.`;
        event = ["Rental completed", reviewed
          ? completion : `${completion} Leave a review.`,
        reviewed ? link : `${link}/review`, 2];
        break;
      }
      case "cancelled":
        event = ["Booking cancelled", `Your booking for ${item} has been cancelled.`, link, 2];
        break;
    }

    const eventKey = rental.status === "extension_requested"
      ? `extension_requested-${rental.extensionSequence ?? 0}`
      : overdue ? "overdue" : rental.status;
    if (event) add(`rental-${rental.id}-${eventKey}`,
      ...event.slice(0, 3), "Rental", event[3], rental.createdAt ?? null);

    // A pending extension does not erase an overdue return reminder.
    if (overdue && rental.status === "extension_requested") {
      add(`rental-${rental.id}-overdue`, "Return overdue",
        `${item} was due on ${formatDate(rental.endDate)}. Coordinate the return.`,
        link, "Rental", 6, rental.endDate);
    }

    const outcome = rental.extensionRequest?.status;
    if (rental.status === "active" && borrower && ["approved", "declined"].includes(outcome)) {
      const approved = outcome === "approved";
      const end = rental.extensionRequest.newEndDate;
      const revision = Number.isSafeInteger(rental.extensionSequence) &&
        rental.extensionSequence > 0 ? `-${rental.extensionSequence}` : "";
      add(`rental-${rental.id}-extension-${outcome}-${end}${revision}`,
        approved ? "Extension approved" : "Extension declined",
        approved ? `Your extension for ${item} was approved. New return date: ${formatDate(end)}.`
          : `Your extension request for ${item} was declined.`,
        `${link}/extension`, "Rental", 5, rental.createdAt ?? null);
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
      `/inbox?conversation=${conversation.id}`, "Message", 4, last.sentAt);
  }

  const time = (value) => Date.parse(value) || 0;
  return notifications.sort((a, b) =>
    b.priority - a.priority ||
    time(b.createdAt) - time(a.createdAt) ||
    a.id.localeCompare(b.id));
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
