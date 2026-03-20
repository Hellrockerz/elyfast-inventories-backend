import { FastifyInstance } from "fastify";
import { db } from "../database";
import { shops, payments } from "../database/schema";
import { eq } from "drizzle-orm";

export async function paymentRoutes(fastify: FastifyInstance) {
  /**
   * POST /webhook
   * Webhook endpoint called by UroPay when a UPI credit SMS is detected.
   * 
   * UroPay sends:
   * { amount: "150.00", referenceNumber: "430686551035", from: "Customer Name", vpa: "abc@icici" }
   * 
   * IMPORTANT: UroPay may call this webhook multiple times:
   * 1. When device receives UPI credit SMS
   * 2. When order is updated with UPI Reference Number
   * Must handle idempotently.
   */
  fastify.post("/webhook", async (request, reply) => {
    const body = request.body as {
      amount?: string;
      referenceNumber?: string;
      from?: string | null;
      vpa?: string | null;
    };

    fastify.log.info("UroPay webhook received:" + JSON.stringify(body));

    const { amount, referenceNumber } = body;

    if (!referenceNumber) {
      // UroPay may send webhook without referenceNumber if companion app isn't installed
      fastify.log.warn("Webhook: No referenceNumber provided");
      return reply.status(200).send({ status: "ok", message: "No reference number — skipped" });
    }

    if (!amount || amount === "0" || amount === "") {
      // If companion app not installed, amount may be empty/0
      fastify.log.warn("Webhook: Amount is empty or 0 — companion app may not be running");
      return reply.status(200).send({ status: "ok", message: "Amount empty — companion app needed" });
    }

    try {
      // Find pending payments matching the amount ₹129
      // Since UroPay webhook doesn't include our transactionId/merchantOrderId,
      // we match by amount and pending status, taking the most recent one
      const amountNum = parseFloat(amount);

      // Find pending payments for ₹129
      const pendingPayments = await db
        .select()
        .from(payments)
        .where(eq(payments.status, "pending"))
        .orderBy(payments.createdAt);

      // Find the first pending payment matching ₹129 amount
      const matchingPayment = pendingPayments.find(
        (p) => Math.abs(parseFloat(p.amount) - amountNum) < 1 // Allow ₹1 tolerance
      );

      if (!matchingPayment) {
        fastify.log.warn(`Webhook: No pending payment found for amount ₹${amount}`);
        // Still return 200 so UroPay doesn't retry
        return reply.status(200).send({ status: "ok", message: "No matching pending payment found" });
      }

      // Check if already processed (idempotency)
      if (matchingPayment.status === "success") {
        return reply.status(200).send({ status: "already_processed", message: "Payment already processed" });
      }

      // Update payment status to success and store reference number
      await db
        .update(payments)
        .set({
          status: "success",
          transactionId: referenceNumber, // Store UPI reference number
          updatedAt: new Date(),
        })
        .where(eq(payments.id, matchingPayment.id));

      // Extend shop subscription by 30 days
      const shopResult = await db
        .select()
        .from(shops)
        .where(eq(shops.id, matchingPayment.shopId))
        .limit(1);

      if (shopResult[0]) {
        const shop = shopResult[0];
        const now = new Date();
        // If current subscription is still valid, extend from its end date
        const baseDate =
          shop.subscriptionValidUntil && shop.subscriptionValidUntil > now
            ? shop.subscriptionValidUntil
            : now;
        const newValidUntil = new Date(
          baseDate.getTime() + matchingPayment.daysGranted * 24 * 60 * 60 * 1000
        );

        await db
          .update(shops)
          .set({
            subscriptionStatus: "active",
            subscriptionValidUntil: newValidUntil,
            planType: "premium",
            updatedAt: new Date(),
          })
          .where(eq(shops.id, matchingPayment.shopId));

        fastify.log.info(
          `✅ Payment success: Shop ${matchingPayment.shopId} subscription extended to ${newValidUntil.toISOString()}`
        );
      }

      // MUST return 200 OK else UroPay marks webhook as FAILED
      return reply.status(200).send({
        status: "success",
        message: "Payment processed and subscription activated",
      });
    } catch (err) {
      fastify.log.error(err);
      // Still return 200 to prevent UroPay retry loops
      return reply.status(200).send({ status: "error", message: "Internal error but acknowledged" });
    }
  });

  /**
   * GET /verify/:transactionId
   * Frontend polls this to check if payment has been confirmed via webhook.
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

  /**
   * GET /check-uropay/:uroPayOrderId
   * Polls UroPay /order/status directly (no auth needed per docs).
   * Can also be called from frontend directly.
   */
  fastify.get("/check-uropay/:uroPayOrderId", async (request, reply) => {
    const { uroPayOrderId } = request.params as { uroPayOrderId: string };

    try {
      const response = await fetch(
        `https://api.uropay.me/order/status/${uroPayOrderId}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-API-KEY": process.env.UROPAY_API_KEY || "",
          },
        }
      );
      const result = await response.json();
      return result;
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to check UroPay status" });
    }
  });
}
