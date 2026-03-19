import { timestamp, pgEnum, text, serial } from "drizzle-orm/pg-core";

// export const statusEnum = pgEnum("app_status", ["active", "inactive", "archived", "deleted"]);

export const standardFields = {
  id: serial("id").primaryKey(), // Auto-incrementing integer ID
  uuid: text("uuid"), // Original client-side UUID for sync reconciliation
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
};
