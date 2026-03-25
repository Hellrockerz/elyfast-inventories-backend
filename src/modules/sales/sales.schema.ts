import { pgTable, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { shops } from "../shops/shops.schema";

export const invoices = pgTable("invoices", {
  ...standardFields,
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull(),
  customerName: varchar("customer_name", { length: 255 }),
  customerPhone: varchar("customer_phone", { length: 20 }),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 12, scale: 2 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  paymentMethod: varchar("payment_method", { length: 50 }).default("cash"), // cash, upi, card, credit
});
