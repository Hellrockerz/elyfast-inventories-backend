import { pgTable, varchar, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";

export const shops = pgTable("shops", {
  ...standardFields,
  name: varchar("name", { length: 255 }).notNull(),
  ownerName: varchar("owner_name", { length: 255 }), 
  ownerId: text("owner_id").notNull(), // Firebase UID
  businessType: varchar("business_type", { length: 50 }).notNull(), // pharmacy, grocery, etc.
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  // Subscription fields
  subscriptionStatus: varchar("subscription_status", { length: 20 }).default("pending").notNull(), // pending, trialing, active, expired
  subscriptionValidUntil: timestamp("subscription_valid_until"),
  planType: varchar("plan_type", { length: 20 }).default("free").notNull(), // free, premium
  trialUsed: boolean("trial_used").default(false).notNull(), // Prevent promo code abuse
});
