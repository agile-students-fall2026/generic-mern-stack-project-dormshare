// Item request lookups shared by routes (#114). The requests board uses this now, and the
// item requests routes should use it too so both always agree on what "open" means.

// Open item requests, newest first.
export const getOpenItemRequests = (data) =>
  data.itemRequests
    .filter((request) => request.status === "open")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

// Only the requester sees every response. Other students see just their own, so
// they can't tell who else replied. Returns a copy; the stored request is unchanged.
export const itemRequestForViewer = (request, userId) =>
  String(request.requesterId) === String(userId)
    ? request
    : { ...request, responses: request.responses.filter((item) => String(item.responderId) === String(userId)) };
