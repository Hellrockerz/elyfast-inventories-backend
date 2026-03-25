import { eq } from "drizzle-orm";
import { items } from "./products.schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

export class ProductService {
  constructor(private db: any) {}

  async getItemByUuid(uuid: string) {
    const result = await this.db.select().from(items).where(eq(items.uuid, uuid)).limit(1);
    return result[0] || null;
  }

  async createItem(payload: any, shopId: number) {
    const inserted = await this.db.insert(items).values({
      uuid: payload.id,
      shopId: shopId,
      name: payload.name,
      sku: payload.sku,
      barcode: payload.barcode,
      purchasePrice: payload.purchasePrice?.toString(),
      sellingPrice: payload.sellingPrice?.toString(),
      stockQuantity: payload.stockQuantity?.toString(),
      lowStockThreshold: payload.lowStockThreshold?.toString(),
      expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
      batchNumber: payload.batchNumber,
      status: payload.status || 'active',
      createdAt: new Date(payload.createdAt || Date.now()),
      updatedAt: new Date(),
    }).returning({ id: items.id });
    return inserted[0].id;
  }

  async updateItem(uuid: string, payload: any) {
    const item = await this.getItemByUuid(uuid);
    if (!item) return null;

    await this.db.update(items)
      .set({
        name: payload.name,
        sku: payload.sku,
        barcode: payload.barcode,
        purchasePrice: payload.purchasePrice?.toString(),
        sellingPrice: payload.sellingPrice?.toString(),
        stockQuantity: payload.stockQuantity?.toString(),
        lowStockThreshold: payload.lowStockThreshold?.toString(),
        expiryDate: payload.expiryDate ? new Date(payload.expiryDate) : null,
        batchNumber: payload.batchNumber,
        status: payload.status,
        updatedAt: new Date()
      })
      .where(eq(items.id, item.id));
    return item.id;
  }

  async deleteItem(uuid: string) {
    const item = await this.getItemByUuid(uuid);
    if (!item) return null;

    await this.db.update(items)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(items.id, item.id));
    return item.id;
  }
}
