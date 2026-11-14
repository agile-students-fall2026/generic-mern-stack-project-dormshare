import { Router } from "express";

export const ownerDashboardRouter = Router();

ownerDashboardRouter.get("/dashboard", async (request, response) => {
  const data = await request.app.locals.mockDataStore.load();
  const ownedRentals = data.rentals.filter((rental) => rental.ownerId === request.currentUserId);
  const listings = new Map(data.listings.map((listing) => [listing.id, listing]));
  const users = new Map(data.users.map((user) => [user.id, user]));
  const summary = {
    totalRentals: ownedRentals.length,
    activeRentals: ownedRentals.filter((rental) => ["active", "extension_requested"].includes(rental.status)).length,
    recordedIncome: Math.round(ownedRentals.filter((rental) => rental.status === "completed")
      .reduce((total, rental) => total + rental.totalPrice, 0) * 100) / 100,
  };
  const rentals = ownedRentals.map((rental) => ({
    ...rental,
    listingTitle: listings.get(rental.listingId)?.title ?? "Listing unavailable",
    borrowerName: users.get(rental.borrowerId)?.name ?? rental.borrowerId,
  }));

  response.json({ summary, rentals });
});
