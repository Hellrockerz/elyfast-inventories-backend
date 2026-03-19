import { FastifyInstance } from "fastify";
import { db } from "../database/index"; // I need to setup the db instance
import { items, invoices, invoiceItems, stockMovements, syncLogs } from "../database/schema";
import { eq, sql } from "drizzle-orm";

interface SyncOperation {
  id: string;
  shopId: string;
  deviceId: string;
  operationType: 'create_item' | 'update_item' | 'delete_item' | 'create_invoice' | 'update_stock';
  resourceType: string;
  payload: any;
  createdAt: number;
}

export async function syncRoutes(fastify: FastifyInstance) {
  fastify.post("/", async (request, reply) => {
    const op = request.body as SyncOperation;
    const { id, operationType, resourceType, payload, shopId } = op;

    try {
      // Basic idempotency check
      const existing = await fastify.db.select().from(syncLogs).where(eq(syncLogs.resourceId, id)).limit(1);
      if (existing.length > 0) {
        return { status: "already_synced", id };
      }

      await fastify.db.transaction(async (tx) => {
        if (operationType === 'create_item') {
          await tx.insert(items).values({
            id: payload.id,
            shopId: payload.shopId,
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
          });
        } else if (operationType === 'update_item') {
          await tx.update(items)
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
            .where(eq(items.id, payload.id));
        } else if (operationType === 'delete_item') {
          await tx.update(items)
            .set({ 
              status: 'deleted', 
              updatedAt: new Date() 
            })
            .where(eq(items.id, payload.id));
        } else if (operationType === 'create_invoice') {
          const { invoice, items: billItems } = payload;
          await tx.insert(invoices).values({
            id: invoice.id,
            shopId: invoice.shopId,
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
          });

          for (const item of billItems) {
            const itemId = item.itemId || item.id;
            const qty = item.quantity || item.billingQuantity || 0;
            
            await tx.insert(invoiceItems).values({
              id: item.id || crypto.randomUUID(), 
              invoiceId: invoice.id,
              itemId: itemId,
              itemName: item.itemName || item.name,
              quantity: qty.toString(),
              unitPrice: (item.unitPrice || item.sellingPrice || 0).toString(),
              totalPrice: (item.totalPrice || (qty * (item.unitPrice || item.sellingPrice || 0))).toString(),
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            
            // Update stock level on server
            await tx.update(items)
              .set({
                stockQuantity: sql`${items.stockQuantity} - ${qty.toString()}`,
                updatedAt: new Date()
              })
              .where(eq(items.id, itemId));

            // Record stock movement
            await tx.insert(stockMovements).values({
              id: crypto.randomUUID(),
              shopId,
              itemId: itemId,
              quantityChange: (-qty).toString(),
              reason: 'sale',
              referenceId: invoice.id,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        } else if (operationType === 'update_stock') {
          await tx.insert(stockMovements).values({
            id: payload.id || crypto.randomUUID(),
            shopId: payload.shopId || shopId,
            itemId: payload.itemId,
            quantityChange: payload.quantityChange?.toString(),
            reason: payload.reason || 'adjustment',
            referenceId: payload.referenceId,
            status: payload.status || 'active',
            createdAt: new Date(payload.createdAt || Date.now()),
            updatedAt: new Date(),
          });

          // Also update the item's current stock
          await tx.update(items)
            .set({
              stockQuantity: sql`${items.stockQuantity} + ${payload.quantityChange?.toString()}`,
              updatedAt: new Date()
            })
            .where(eq(items.id, payload.itemId));
        }

        // Log the sync
        await tx.insert(syncLogs).values({
          id: crypto.randomUUID(),
          shopId,
          deviceId: op.deviceId,
          operationType,
          resourceType,
          resourceId: id,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      return { status: "success", id };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Sync failed" });
    }
  });
}
