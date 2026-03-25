import { pgTable, varchar, integer, text } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { shops } from "../shops/shops.schema";

export const syncLogs = pgTable("sync_logs", {
  ...standardFields,
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  deviceId: varchar("device_id", { length: 255 }).notNull(),
  operationType: varchar("operation_type", { length: 50 }).notNull(), // create_item, update_stock, etc.
  resourceType: varchar("resource_type", { length: 50 }).notNull(), // items, invoices, etc.
  resourceId: text("resource_id").notNull(), // Stores the client UUID
  syncToken: text("sync_token"), // to prevent duplicates
});
