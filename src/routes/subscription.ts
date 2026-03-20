import { FastifyInstance } from "fastify";
import { db } from "../database";
import { shops, promoCodes, payments } from "../database/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

export async function subscriptionRoutes(fastify: FastifyInstance) {
  /**
   * GET /status/:shopId
   * Returns the current subscription status for a shop
   */
  fastify.get("/status/:shopId", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };

    try {
      let shop;
      if (!isNaN(Number(shopId)) && shopId.length < 10) {
        const result = await db.select().from(shops).where(eq(shops.id, Number(shopId))).limit(1);
        shop = result[0];
      } else {
        const result = await db.select().from(shops).where(eq(shops.uuid, shopId)).limit(1);
        shop = result[0];
      }

      if (!shop) {
        return reply.status(404).send({ status: "error", message: "Shop not found" });
      }

      // Auto-expire if valid until is past
      const now = new Date();
      let subscriptionStatus = shop.subscriptionStatus;
      if (shop.subscriptionValidUntil && shop.subscriptionValidUntil < now && subscriptionStatus !== "expired") {
        subscriptionStatus = "expired";
        await db
          .update(shops)
          .set({ subscriptionStatus: "expired", updatedAt: new Date() })
          .where(eq(shops.id, shop.id));
      }

      return {
        subscriptionStatus,
        subscriptionValidUntil: shop.subscriptionValidUntil,
        planType: shop.planType,
        trialUsed: shop.trialUsed,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });

  /**
   * POST /apply-promo
   * Apply a promo code (e.g., FREE60) to grant free trial days
   */
  fastify.post("/apply-promo", async (request, reply) => {
    const { shopId, code } = request.body as { shopId: string; code: string };

    if (!shopId || !code) {
      return reply.status(400).send({ status: "error", message: "shopId and code are required" });
    }

    try {
      // Resolve shop
      let shop;
      if (!isNaN(Number(shopId)) && shopId.length < 10) {
        const result = await db.select().from(shops).where(eq(shops.id, Number(shopId))).limit(1);
        shop = result[0];
      } else {
        const result = await db.select().from(shops).where(eq(shops.uuid, shopId)).limit(1);
        shop = result[0];
      }

      if (!shop) {
        return reply.status(404).send({ status: "error", message: "Shop not found" });
      }

      // Check if trial already used
      if (shop.trialUsed) {
        return reply.status(400).send({
          status: "error",
          message: "A promo code has already been used for this shop. Please subscribe to continue.",
        });
      }

      // Validate promo code
      const promoResult = await db.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
      const promo = promoResult[0];

      if (!promo) {
        return reply.status(400).send({ status: "error", message: "Invalid promo code" });
      }

      if (!promo.isActive) {
        return reply.status(400).send({ status: "error", message: "This promo code is no longer active" });
      }

      if (promo.currentUsage >= promo.usageLimit) {
        return reply.status(400).send({ status: "error", message: "This promo code has reached its usage limit" });
      }

      // Apply promo: extend subscription
      const now = new Date();
      const validUntil = new Date(now.getTime() + promo.daysGranted * 24 * 60 * 60 * 1000);

      await db
        .update(shops)
        .set({
          subscriptionStatus: "trialing",
          subscriptionValidUntil: validUntil,
          planType: "free",
          trialUsed: true,
          updatedAt: new Date(),
        })
        .where(eq(shops.id, shop.id));

      // Increment promo usage
      await db
        .update(promoCodes)
        .set({
          currentUsage: sql`${promoCodes.currentUsage} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(promoCodes.id, promo.id));

      return {
        status: "success",
        message: `Promo code applied! You have ${promo.daysGranted} days of free access.`,
        subscriptionStatus: "trialing",
        subscriptionValidUntil: validUntil,
        daysGranted: promo.daysGranted,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to apply promo code" });
    }
  });

  /**
   * POST /create-order
   * Creates a payment order for UroPay UPI integration
   * Monthly plan: ₹129/month
   */
  fastify.post("/create-order", async (request, reply) => {
    const { shopId } = request.body as { shopId: string };

    if (!shopId) {
      return reply.status(400).send({ status: "error", message: "shopId is required" });
    }

    try {
      // Resolve shop
      let shop;
      if (!isNaN(Number(shopId)) && shopId.length < 10) {
        const result = await db.select().from(shops).where(eq(shops.id, Number(shopId))).limit(1);
        shop = result[0];
      } else {
        const result = await db.select().from(shops).where(eq(shops.uuid, shopId)).limit(1);
        shop = result[0];
      }

      if (!shop) {
        return reply.status(404).send({ status: "error", message: "Shop not found" });
      }

      // Generate unique transaction ID
      const transactionId = `ELY-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

      // Record the pending payment
      await db.insert(payments).values({
        shopId: shop.id,
        transactionId,
        amount: "129.00",
        currency: "INR",
        status: "pending",
        paymentMethod: "upi",
        daysGranted: 30,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return {
        status: "success",
        transactionId,
        amount: 129,
        currency: "INR",
        shopId: shop.uuid || shop.id.toString(),
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to create order" });
    }
  });
}
