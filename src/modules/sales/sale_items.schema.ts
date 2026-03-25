import { pgTable, varchar, decimal, integer } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { invoices } from "./sales.schema";
import { items } from "../products/products.schema";

export const invoiceItems = pgTable("invoice_items", {
  ...standardFields,
  invoiceId: integer("invoice_id").references(() => invoices.id).notNull(),
  itemId: integer("item_id").references(() => items.id).notNull(),
  itemName: varchar("item_name", { length: 255 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 12, scale: 2 }).notNull(),
});
