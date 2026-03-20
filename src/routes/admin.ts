import { FastifyInstance } from "fastify";
import { db } from "../database";
import { shops, promoCodes, payments } from "../database/schema";
import { eq, desc, sql } from "drizzle-orm";
import { auth } from "../services/firebase";

/**
 * Admin routes - Protected by Firebase Custom Claims (admin: true)
 * 
 * To set an admin user, use the set-admin script:
 *   npx ts-node src/scripts/set-admin.ts <firebase-uid>
 */
export async function adminRoutes(fastify: FastifyInstance) {
  // Admin authentication hook - checks Firebase custom claim
  fastify.addHook("preHandler", async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.status(401).send({ status: "error", message: "Unauthorized" });
    }

    try {
      const token = authHeader.split("Bearer ")[1];
      const decoded = await auth.verifyIdToken(token);

      if (!decoded.admin) {
        return reply.status(403).send({ status: "error", message: "Admin access required" });
      }

      (request as any).adminUser = decoded;
    } catch (err) {
      return reply.status(401).send({ status: "error", message: "Invalid token" });
    }
  });

  // ==================== SHOPS MANAGEMENT ====================

  /**
   * GET /shops - List all shops with subscription info
   */
  fastify.get("/shops", async (request, reply) => {
    try {
      const allShops = await db
        .select({
          id: shops.id,
          uuid: shops.uuid,
          name: shops.name,
          ownerName: shops.ownerName,
          ownerId: shops.ownerId,
          businessType: shops.businessType,
          subscriptionStatus: shops.subscriptionStatus,
          subscriptionValidUntil: shops.subscriptionValidUntil,
          planType: shops.planType,
          trialUsed: shops.trialUsed,
          createdAt: shops.createdAt,
        })
        .from(shops)
        .orderBy(desc(shops.createdAt));

      return { status: "success", shops: allShops };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });

  /**
   * PUT /shops/:shopId/subscription - Manually override a shop's subscription
   */
  fastify.put("/shops/:shopId/subscription", async (request, reply) => {
    const { shopId } = request.params as { shopId: string };
    const { subscriptionStatus, subscriptionValidUntil, planType } = request.body as {
      subscriptionStatus?: string;
      subscriptionValidUntil?: string;
      planType?: string;
    };

    try {
      const updateData: any = { updatedAt: new Date() };
      if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus;
      if (subscriptionValidUntil) updateData.subscriptionValidUntil = new Date(subscriptionValidUntil);
      if (planType) updateData.planType = planType;

      await db.update(shops).set(updateData).where(eq(shops.id, Number(shopId)));

      return { status: "success", message: "Subscription updated" };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to update subscription" });
    }
  });

  // ==================== PROMO CODES MANAGEMENT ====================

  /**
   * GET /promo-codes - List all promo codes
   */
  fastify.get("/promo-codes", async (request, reply) => {
    try {
      const codes = await db
        .select()
        .from(promoCodes)
        .orderBy(desc(promoCodes.createdAt));

      return { status: "success", promoCodes: codes };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });

  /**
   * POST /promo-codes - Create a new promo code
   */
  fastify.post("/promo-codes", async (request, reply) => {
    const { code, daysGranted, usageLimit } = request.body as {
      code: string;
      daysGranted?: number;
      usageLimit?: number;
    };

    if (!code) {
      return reply.status(400).send({ status: "error", message: "code is required" });
    }

    try {
      const inserted = await db
        .insert(promoCodes)
        .values({
          code: code.toUpperCase(),
          daysGranted: daysGranted || 60,
          usageLimit: usageLimit || 1000,
          currentUsage: 0,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return { status: "success", promoCode: inserted[0] };
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.status(400).send({ status: "error", message: "Promo code already exists" });
      }
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to create promo code" });
    }
  });

  /**
   * PUT /promo-codes/:id/toggle - Toggle a promo code active/inactive
   */
  fastify.put("/promo-codes/:id/toggle", async (request, reply) => {
    const { id } = request.params as { id: string };

    try {
      const existing = await db.select().from(promoCodes).where(eq(promoCodes.id, Number(id))).limit(1);
      if (!existing[0]) {
        return reply.status(404).send({ status: "error", message: "Promo code not found" });
      }

      await db
        .update(promoCodes)
        .set({
          isActive: !existing[0].isActive,
          updatedAt: new Date(),
        })
        .where(eq(promoCodes.id, Number(id)));

      return {
        status: "success",
        message: `Promo code ${existing[0].isActive ? "deactivated" : "activated"}`,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to toggle promo code" });
    }
  });

  // ==================== PAYMENTS HISTORY ====================

  /**
   * GET /payments - List all payments
   */
  fastify.get("/payments", async (request, reply) => {
    try {
      const allPayments = await db
        .select()
        .from(payments)
        .orderBy(desc(payments.createdAt));

      return { status: "success", payments: allPayments };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });
}
