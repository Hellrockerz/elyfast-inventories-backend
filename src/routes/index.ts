import { FastifyInstance } from "fastify";
import { syncRoutes } from "./sync";
import { authRoutes } from "./auth";

export async function registerRoutes(fastify: FastifyInstance) {
  fastify.get("/health", async () => {
    return { status: "ok" };
  });

  // Future routes:
  await fastify.register(authRoutes, { prefix: "/auth" });
  // fastify.register(inventoryRoutes, { prefix: "/inventory" });
  // fastify.register(billingRoutes, { prefix: "/billing" });
  // fastify.register(reportRoutes, { prefix: "/reports" });
  await fastify.register(syncRoutes, { prefix: "/sync" });
}
