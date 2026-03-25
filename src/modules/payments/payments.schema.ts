import { pgTable, varchar, decimal, integer, timestamp, boolean, serial } from "drizzle-orm/pg-core";
import { shops } from "../shops/shops.schema";

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 50 }).notNull().unique(),
  daysGranted: integer("days_granted").notNull().default(60),
  usageLimit: integer("usage_limit").notNull().default(1000), // Global max redemptions
  currentUsage: integer("current_usage").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  transactionId: varchar("transaction_id", { length: 255 }).notNull().unique(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // e.g. 129.00
  currency: varchar("currency", { length: 10 }).default("INR").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(), // pending, success, failed
  paymentMethod: varchar("payment_method", { length: 50 }).default("upi").notNull(),
  daysGranted: integer("days_granted").notNull().default(30), // Monthly = 30 days
  promoCodeUsed: varchar("promo_code_used", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
