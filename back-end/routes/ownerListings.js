import { Router } from "express";
import { listingCategories } from "../../shared/options.mjs";

export const ownerListingsRouter = Router();

function listingDetails(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { title, category, description, price, rentalTerms } = body;
  if (![title, description, rentalTerms].every((value) => typeof value === "string" && value.trim()) ||
      !listingCategories.includes(category) || !Number.isFinite(price) || price < 0) return null;

  return { title: title.trim(), category, description: description.trim(), price, rentalTerms: rentalTerms.trim() };
}

// Mount before the public listing router so /mine is not treated as an item ID.
ownerListingsRouter.get("/mine", async (request, response) => {
  const data = await request.app.locals.mockDataStore.load();
  response.json(data.listings.filter((listing) => listing.ownerId === request.currentUserId));
});

ownerListingsRouter.post("/", async (request, response) => {
  const details = listingDetails(request.body);
  if (!details) return response.status(400).json({ error: "Invalid listing details." });

  const data = await request.app.locals.mockDataStore.load();
  const id = Math.max(0, ...data.listings.map((listing) => listing.id)) + 1;
  const listing = {
    ...details,
    id,
    ownerId: request.currentUserId,
    image: `https://picsum.photos/seed/dormshare-${id}/320/240`,
    status: "draft",
  };
  data.listings.unshift(listing);
  response.status(201).json(listing);
});
