import { pgTable, varchar, decimal, integer, text } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { shops } from "../shops/shops.schema";
import { items } from "../products/products.schema";

export const stockMovements = pgTable("stock_movements", {
  ...standardFields,
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  itemId: integer("item_id").references(() => items.id).notNull(),
  quantityChange: decimal("quantity_change", { precision: 12, scale: 3 }).notNull(), // +ve for restock, -ve for sale
  reason: varchar("reason", { length: 100 }).notNull(), // sale, restock, return, adjustment, expiry
  referenceId: text("reference_id"), // e.g. invoice_id or adjustment_id
});
