import { eq, sql } from "drizzle-orm";
import { stockMovements } from "./inventory.schema";
import { items } from "../products/products.schema";

export class InventoryService {
  constructor(private db: any) {}

  async createStockMovement(payload: any, shopId: number, itemIntId: number) {
    const inserted = await this.db.insert(stockMovements).values({
      uuid: payload.id,
      shopId: shopId,
      itemId: itemIntId,
      quantityChange: payload.quantityChange?.toString(),
      reason: payload.reason || 'adjustment',
      referenceId: payload.referenceId?.toString(),
      status: payload.status || 'active',
      createdAt: new Date(payload.createdAt || Date.now()),
      updatedAt: new Date(),
    }).returning({ id: stockMovements.id });

    // Update item stock quantity
    await this.db.update(items)
      .set({
        stockQuantity: sql`${items.stockQuantity} + ${payload.quantityChange?.toString()}`,
        updatedAt: new Date()
      })
      .where(eq(items.id, itemIntId));

    return inserted[0].id;
  }
}
