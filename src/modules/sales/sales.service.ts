import { eq, sql } from "drizzle-orm";
import { invoices } from "./sales.schema";
import { invoiceItems } from "./sale_items.schema";
import { items } from "../products/products.schema";
import { stockMovements } from "../inventory/inventory.schema";
import crypto from "node:crypto";

export class SalesService {
  constructor(private db: any) {}

  async createSale(payload: any, shopId: number, getItemIntId: (uuid: string) => Promise<number | null>) {
    const { invoice, items: billItems } = payload;
    
    const insertedInvoice = await this.db.insert(invoices).values({
      uuid: invoice.id,
      shopId: shopId,
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.customerName,
      customerPhone: invoice.customerPhone,
      totalAmount: invoice.totalAmount?.toString(),
      discountAmount: invoice.discountAmount?.toString(),
      taxAmount: invoice.taxAmount?.toString(),
      paymentMethod: invoice.paymentMethod,
      status: invoice.status || 'active',
      createdAt: new Date(invoice.createdAt || Date.now()),
      updatedAt: new Date(),
    }).returning({ id: invoices.id });
    
    const invIntId = insertedInvoice[0].id;

    for (const item of billItems) {
      const itemIntId = await getItemIntId(item.itemId || item.id);
      if (!itemIntId) continue;

      const qty = item.quantity || item.billingQuantity || 0;
      
      await this.db.insert(invoiceItems).values({
        uuid: item.id || crypto.randomUUID(),
        invoiceId: invIntId,
        itemId: itemIntId,
        itemName: item.itemName || item.name,
        quantity: qty.toString(),
        unitPrice: (item.unitPrice || item.sellingPrice || 0).toString(),
        totalPrice: (item.totalPrice || (qty * (item.unitPrice || item.sellingPrice || 0))).toString(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      await this.db.update(items)
        .set({
          stockQuantity: sql`${items.stockQuantity} - ${qty.toString()}`,
          updatedAt: new Date()
        })
        .where(eq(items.id, itemIntId));

      await this.db.insert(stockMovements).values({
        uuid: crypto.randomUUID(),
        shopId,
        itemId: itemIntId,
        quantityChange: (-qty).toString(),
        reason: 'sale',
        referenceId: invIntId.toString(),
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return invIntId;
  }
}
