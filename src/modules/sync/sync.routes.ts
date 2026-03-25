import { FastifyInstance } from "fastify";
import { SyncController } from "./sync.controller";
import { SyncService } from "./sync.service";
import { ShopService } from "../shops/shops.service";
import { ProductService } from "../products/products.service";
import { InventoryService } from "../inventory/inventory.service";
import { SalesService } from "../sales/sales.service";
import { items } from "../products/products.schema";
import { eq } from "drizzle-orm";

export async function syncRoutes(fastify: FastifyInstance) {
  const productService = new ProductService(fastify.db);
  const inventoryService = new InventoryService(fastify.db);
  const salesService = new SalesService(fastify.db);
  const shopService = new ShopService(fastify.db);
  const syncService = new SyncService(fastify.db, productService, inventoryService, salesService);
  const controller = new SyncController(syncService, shopService);

  fastify.post("/mutations", (req, rep) => controller.syncMutations(req, rep));

  // Maintain backward compatibility for /full-state if needed
  fastify.get("/full-state", async (request, reply) => {
    const { shopId: shopUuid } = request.query as { shopId: string };
    if (!shopUuid) return reply.status(400).send({ error: "shopId is required" });

    try {
      const shop = await shopService.getShopByUuid(shopUuid);
      if (!shop) return reply.status(404).send({ error: "Shop not found" });

      const allItems = await fastify.db.select().from(items).where(eq(items.shopId, shop.id));
      return {
        items: allItems,
        timestamp: Date.now()
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch full state" });
    }
  });
}
