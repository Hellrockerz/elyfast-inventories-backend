import { eq } from "drizzle-orm";
import { syncLogs } from "./sync.schema";
import { ProductService } from "../products/products.service";
import { InventoryService } from "../inventory/inventory.service";
import { SalesService } from "../sales/sales.service";
import crypto from "node:crypto";

export class SyncService {
  constructor(
    private db: any,
    private productService: ProductService,
    private inventoryService: InventoryService,
    private salesService: SalesService
  ) {}

  async processMutations(mutations: any[], shopId: number, deviceId: string) {
    const results = [];

    for (const mutation of mutations) {
      const { id: uuid, operation, payload } = mutation;

      // Idempotency check
      const existing = await this.db.select().from(syncLogs).where(eq(syncLogs.resourceId, uuid)).limit(1);
      if (existing.length > 0) {
        results.push({ status: "already_synced", id: uuid });
        continue;
      }

      try {
        let serverId: number | undefined;

        await this.db.transaction(async (tx: any) => {
          // Re-instantiate services with transaction DB
          const txProductService = new ProductService(tx);
          const txInventoryService = new InventoryService(tx);
          const txSalesService = new SalesService(tx);

          if (operation === 'create_product' || operation === 'create_item') {
            serverId = await txProductService.createItem(payload, shopId);
          } else if (operation === 'update_product' || operation === 'update_item') {
            serverId = (await txProductService.updateItem(payload.id, payload)) || undefined;
          } else if (operation === 'delete_product' || operation === 'delete_item') {
            serverId = (await txProductService.deleteItem(payload.id)) || undefined;
          } else if (operation === 'update_inventory' || operation === 'update_stock') {
            const item = await txProductService.getItemByUuid(payload.itemId);
            if (item) {
              serverId = await txInventoryService.createStockMovement(payload, shopId, item.id);
            }
          } else if (operation === 'create_sale') {
            serverId = await txSalesService.createSale(payload, shopId, async (u) => {
                const i = await txProductService.getItemByUuid(u);
                return i?.id || null;
            });
          }

          // Log sync
          await tx.insert(syncLogs).values({
            uuid: crypto.randomUUID(),
            shopId,
            deviceId,
            operationType: operation,
            resourceType: mutation.table || 'unknown',
            resourceId: uuid,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        });

        results.push({ status: "success", id: uuid, serverId });
      } catch (err) {
        console.error(`Failed to process mutation ${uuid}:`, err);
        results.push({ status: "failed", id: uuid, error: (err as Error).message });
      }
    }

    return results;
  }
}
