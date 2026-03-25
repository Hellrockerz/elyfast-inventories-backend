import { pgTable, varchar, decimal, timestamp, integer } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { shops } from "../shops";

export const items = pgTable("items", {
  ...standardFields,
  shopId: integer("shop_id").references(() => shops.id).notNull(),
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
