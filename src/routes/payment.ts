import { FastifyInstance } from "fastify";
import { db } from "../database";
import { shops, payments } from "../database/schema";
import { eq } from "drizzle-orm";

export async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * POST /webhook
   * Webhook endpoint for UroPay companion app to notify of successful UPI payment.
   * This is called when SMS is detected for the incoming payment.
   * 
   * Expected body from UroPay:
   * { transactionId: string, amount: number, upiId?: string, status: "success" | "failed" }
   */
  fastify.post("/webhook", async (request, reply) => {
    const body = request.body as {
      transactionId?: string;
      amount?: number;
      status?: string;
      upiId?: string;
    };

    const { transactionId, amount, status: paymentStatus } = body;

    if (!transactionId) {
      return reply.status(400).send({ status: "error", message: "transactionId is required" });
    }

    try {
      // Find the pending payment
      const paymentResult = await db
        .select()
        .from(payments)
        .where(eq(payments.transactionId, transactionId))
        .limit(1);
      
      const payment = paymentResult[0];

      if (!payment) {
        fastify.log.warn(`Webhook: Payment not found for transactionId: ${transactionId}`);
        return reply.status(404).send({ status: "error", message: "Payment not found" });
      }

      if (payment.status === "success") {
        return { status: "already_processed", message: "Payment already processed" };
      }

      if (paymentStatus === "success") {
        // Verify amount matches (optional safety check)
        if (amount && Number(payment.amount) !== Number(amount)) {
          fastify.log.warn(`Webhook: Amount mismatch. Expected ${payment.amount}, got ${amount}`);
        }

        // Update payment status
        await db
          .update(payments)
          .set({ status: "success", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));

        // Extend shop subscription
        const shop = await db.select().from(shops).where(eq(shops.id, payment.shopId)).limit(1);
        if (shop[0]) {
          const now = new Date();
          // If current subscription is still valid, extend from its end date
          const baseDate =
            shop[0].subscriptionValidUntil && shop[0].subscriptionValidUntil > now
              ? shop[0].subscriptionValidUntil
              : now;
          const newValidUntil = new Date(baseDate.getTime() + payment.daysGranted * 24 * 60 * 60 * 1000);

          await db
            .update(shops)
            .set({
              subscriptionStatus: "active",
              subscriptionValidUntil: newValidUntil,
              planType: "premium",
              updatedAt: new Date(),
            })
            .where(eq(shops.id, payment.shopId));

          fastify.log.info(
            `Payment success: Shop ${payment.shopId} subscription extended to ${newValidUntil.toISOString()}`
          );
        }

        return { status: "success", message: "Payment processed and subscription activated" };
      } else {
        // Payment failed
        await db
          .update(payments)
          .set({ status: "failed", updatedAt: new Date() })
          .where(eq(payments.id, payment.id));

        return { status: "failed", message: "Payment marked as failed" };
      }
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Webhook processing failed" });
    }
  });

  /**
   * GET /verify/:transactionId
   * Frontend can poll this to check if payment has been confirmed via webhook.
   */
  fastify.get("/verify/:transactionId", async (request, reply) => {
    const { transactionId } = request.params as { transactionId: string };

    try {
      const paymentResult = await db
        .select()
        .from(payments)
        .where(eq(payments.transactionId, transactionId))
        .limit(1);

      const payment = paymentResult[0];
      if (!payment) {
        return reply.status(404).send({ status: "error", message: "Payment not found" });
      }

      return {
        status: payment.status,
        transactionId: payment.transactionId,
        amount: payment.amount,
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });
}
