import { FastifyInstance } from "fastify";
import { shops, items, invoices, invoiceItems, stockMovements, syncLogs } from "../database/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "node:crypto";

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
  // Helper to resolve Shop UUID to Integer ID
  const getShopIntId = async (uuid: string) => {
    if (!uuid) return null;
    // If uuid is numeric, it might already be the IntId
    if (!isNaN(Number(uuid)) && uuid.length < 10) return Number(uuid);
    
    const shop = await fastify.db.select().from(shops).where(eq(shops.uuid, uuid)).limit(1);
    return shop[0]?.id || null;
  };

  // Helper to resolve Item UUID to Integer ID
  const getItemIntId = async (uuid: string) => {
    if (!uuid) return null;
    if (!isNaN(Number(uuid)) && uuid.length < 10) return Number(uuid);
    const item = await fastify.db.select().from(items).where(eq(items.uuid, uuid)).limit(1);
    return item[0]?.id || null;
  };

  fastify.get("/full-state", async (request, reply) => {
    const { shopId: shopUuid } = request.query as { shopId: string };
    if (!shopUuid) return reply.status(400).send({ error: "shopId is required" });

    try {
      const shopId = await getShopIntId(shopUuid);
      if (!shopId) return reply.status(404).send({ error: "Shop not found" });

      const allItems = await fastify.db.select().from(items).where(eq(items.shopId, shopId));
      return {
        items: allItems,
        timestamp: Date.now()
      };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch full state" });
    }
  });

  fastify.post("/", async (request, reply) => {
    const op = request.body as SyncOperation;
    const { id: uuid, operationType, resourceType, payload, shopId: shopUuid } = op;

    try {
      const shopId = await getShopIntId(shopUuid);
      if (!shopId) return reply.status(404).send({ status: "error", message: "Shop not found" });

      // Basic idempotency check using the client UUID
      const existing = await fastify.db.select().from(syncLogs).where(eq(syncLogs.resourceId, uuid)).limit(1);
      if (existing.length > 0) {
        let serverId: number | undefined;
        const resType = existing[0].resourceType;
        
        // Try to find the actual server-side integer ID of the resource
        try {
          if (resType === 'items') {
            // For items, the resourceId is usually the UUID
            const item = await fastify.db.select().from(items).where(eq(items.uuid, uuid)).limit(1);
            serverId = item[0]?.id;
          } else if (resType === 'invoices') {
            const invoice = await fastify.db.select().from(invoices).where(eq(invoices.uuid, uuid)).limit(1);
            serverId = invoice[0]?.id;
          } else if (resType === 'stock_movements') {
            const movement = await fastify.db.select().from(stockMovements).where(eq(stockMovements.uuid, uuid)).limit(1);
            serverId = movement[0]?.id;
          }
        } catch (err) {
          fastify.log.error(err, "Failed to fetch serverId for already_synced operation");
        }

        return { status: "already_synced", id: uuid, serverId };
      }

      let serverId: number | undefined;

      await fastify.db.transaction(async (tx) => {
        if (operationType === 'create_item') {
          const inserted = await tx.insert(items).values({
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
          serverId = inserted[0].id;
        } else if (operationType === 'update_item') {
          const itemIntId = await getItemIntId(payload.id);
          if (itemIntId) {
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
              .where(eq(items.id, itemIntId));
            serverId = itemIntId;
          }
        } else if (operationType === 'delete_item') {
          const itemIntId = await getItemIntId(payload.id);
          if (itemIntId) {
            await tx.update(items)
              .set({ status: 'deleted', updatedAt: new Date() })
              .where(eq(items.id, itemIntId));
          }
        } else if (operationType === 'create_invoice') {
          const { invoice, items: billItems } = payload;
          const insertedInvoice = await tx.insert(invoices).values({
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
          serverId = invIntId;

          for (const item of billItems) {
            const itemIntId = await getItemIntId(item.itemId || item.id);
            if (!itemIntId) continue;

            const qty = item.quantity || item.billingQuantity || 0;
            
            await tx.insert(invoiceItems).values({
              uuid: item.id,
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
            
            await tx.update(items)
              .set({
                stockQuantity: sql`${items.stockQuantity} - ${qty.toString()}`,
                updatedAt: new Date()
              })
              .where(eq(items.id, itemIntId));

            await tx.insert(stockMovements).values({
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
        } else if (operationType === 'update_stock') {
          const itemIntId = await getItemIntId(payload.itemId);
          if (itemIntId) {
            const insertedMovement = await tx.insert(stockMovements).values({
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

            serverId = insertedMovement[0].id;

            await tx.update(items)
              .set({
                stockQuantity: sql`${items.stockQuantity} + ${payload.quantityChange?.toString()}`,
                updatedAt: new Date()
              })
              .where(eq(items.id, itemIntId));
          }
        }

        await tx.insert(syncLogs).values({
          uuid: crypto.randomUUID(),
          shopId,
          deviceId: op.deviceId,
          operationType,
          resourceType,
          resourceId: uuid,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      });

      return { status: "success", id: uuid, serverId };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Sync failed" });
    }
  });
}
