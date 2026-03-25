import { FastifyInstance } from "fastify";
import { syncRoutes } from "../modules/sync/sync.routes";
import { productRoutes } from "../modules/products/products.routes";
import { authRoutes } from "./auth";
import { subscriptionRoutes } from "./subscription";
import { paymentRoutes } from "./payment";
import { adminRoutes } from "./admin";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  // Auth (exempt from subscription guard)
  await fastify.register(authRoutes, { prefix: "/auth" });

  // Subscription management (exempt from subscription guard)
  await fastify.register(subscriptionRoutes, { prefix: "/subscription" });

  // Payment webhooks & verification (exempt from subscription guard)
  await fastify.register(paymentRoutes, { prefix: "/payments" });

  // Admin panel (exempt from subscription guard, uses its own Firebase auth)
  await fastify.register(adminRoutes, { prefix: "/admin" });

  // Modular Routes
  await fastify.register(productRoutes, { prefix: "/products" });
  
  // Sync (protected by subscription guard for write operations)
  await fastify.register(syncRoutes, { prefix: "/sync" });
}
