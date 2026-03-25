import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import { db } from "../database";
import { shops } from "../database/schema";
import { eq } from "drizzle-orm";
import { auth } from "../services/firebase";


/**
 * Subscription Guard Middleware
 * 
 * Checks the shop's subscription status before allowing write operations.
 * - GET requests are ALWAYS allowed (read-only / print).
 * - POST/PUT/PATCH/DELETE requests return 402 if subscription is expired.
 * 
 * Routes that should be exempt (e.g., payment/webhook routes) must be
 * registered BEFORE this plugin or excluded via the skip list.
 */

const EXEMPT_PREFIXES = [
  "/api/health",
  "/api/auth",
  "/api/subscription",
  "/api/payments",
  "/api/admin",
];

async function subscriptionGuard(fastify: FastifyInstance) {
  fastify.addHook("preHandler", async (request: FastifyRequest, reply: FastifyReply) => {
    // Allow all GET/HEAD/OPTIONS requests (read-only)
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      return;
    }

    // Skip exempt routes
    const url = request.url;
    if (EXEMPT_PREFIXES.some((prefix) => url.startsWith(prefix))) {
      return;
    }

    // Extract shopId from body or query
    const body = request.body as any;
    const query = request.query as any;
    const shopUuid = body?.shopId || query?.shopId;

    if (!shopUuid) {
      // If no shopId in request, skip this guard (let the route handle validation)
      return;
    }

    // Check if requester is an admin
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      try {
        const token = authHeader.split("Bearer ")[1];
        const decoded = await auth.verifyIdToken(token);
        if (decoded.admin) {
          return; // Skip subscription check for admins
        }
      } catch (err) {
        // Log token verification error but continue with subscription check
        fastify.log.debug("Failed to verify token in subscription guard: " + (err as any).message);
      }
    }

    try {
      // Resolve shop UUID to record
      let shop;
      if (!isNaN(Number(shopUuid)) && String(shopUuid).length < 10) {
        const result = await db.select().from(shops).where(eq(shops.id, Number(shopUuid))).limit(1);
        shop = result[0];
      } else {
        const result = await db.select().from(shops).where(eq(shops.uuid, shopUuid)).limit(1);
        shop = result[0];
      }

      if (!shop) {
        return; // Let route handle missing shop
      }

      // Check subscription
      const now = new Date();
      const validUntil = shop.subscriptionValidUntil;
      const status = shop.subscriptionStatus;

      // If status is expired, or validUntil is in the past
      if (
        status === "expired" ||
        (validUntil && validUntil < now) ||
        (!validUntil && status !== "active" && status !== "trialing")
      ) {
        // Mark as expired if not already
        if (status !== "expired" && validUntil && validUntil < now) {
          await db
            .update(shops)
            .set({ subscriptionStatus: "expired", updatedAt: new Date() })
            .where(eq(shops.id, shop.id));
        }

        return reply.status(402).send({
          status: "payment_required",
          message: "Your subscription has expired. Please renew to continue using create, update, and delete features.",
          subscriptionStatus: "expired",
          subscriptionValidUntil: validUntil,
        });
      }
    } catch (err) {
      fastify.log.error(err, "Subscription guard error");
      // Don't block the request on guard errors, let it through
    }
  });
}

export default fp(subscriptionGuard);
