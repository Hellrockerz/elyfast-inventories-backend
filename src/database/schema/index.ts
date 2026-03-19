import { pgTable, text, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { standardFields } from "./standard-fields";

export const shops = pgTable("shops", {
  ...standardFields,
  name: varchar("name", { length: 255 }).notNull(),
  ownerName: varchar("owner_name", { length: 255 }), 
  ownerId: text("owner_id").notNull(), // Firebase UID
  businessType: varchar("business_type", { length: 50 }).notNull(), // pharmacy, grocery, etc.
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
});

export const items = pgTable("items", {
  ...standardFields,
  shopId: text("shop_id").references(() => shops.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  sku: varchar("sku", { length: 50 }),
  barcode: varchar("barcode", { length: 50 }),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }),
  sellingPrice: decimal("selling_price", { precision: 12, scale: 2 }).notNull(),
  stockQuantity: decimal("stock_quantity", { precision: 12, scale: 3 }).default("0").notNull(),
  lowStockThreshold: decimal("low_stock_threshold", { precision: 12, scale: 3 }).default("5").notNull(),
  // Pharmacy specific (optional)
  expiryDate: timestamp("expiry_date"),
  batchNumber: varchar("batch_number", { length: 50 }),
});

export const invoices = pgTable("invoices", {
  ...standardFields,
  shopId: text("shop_id").references(() => shops.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // cash, upi, card, credit
});

export const invoiceItems = pgTable("invoice_items", {
  ...standardFields,
  invoiceId: text("invoice_id").references(() => invoices.id).notNull(),
  itemId: text("item_id").references(() => items.id).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
});

export const stockMovements = pgTable("stock_movements", {
  ...standardFields,
  shopId: text("shop_id").references(() => shops.id).notNull(),
  itemId: text("item_id").references(() => items.id).notNull(),
  quantityChange: decimal("quantity_change", { precision: 12, scale: 3 }).notNull(), // +ve for restock, -ve for sale
  reason: varchar("reason", { length: 100 }).notNull(), // sale, restock, return, adjustment, expiry
  referenceId: text("reference_id"), // e.g. invoice_id or adjustment_id
});

export const syncLogs = pgTable("sync_logs", {
  ...standardFields,
  shopId: text("shop_id").references(() => shops.id).notNull(),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(), // create_item, update_stock, etc.
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // items, invoices, etc.
  resourceId: text("resource_id").notNull(),
  status: text("status").default("active").notNull(), // active here means pending/confirmed
  syncToken: text("sync_token"), // to prevent duplicates
});
