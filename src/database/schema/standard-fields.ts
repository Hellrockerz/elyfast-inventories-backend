import { timestamp, pgEnum, text } from "drizzle-orm/pg-core";

// export const statusEnum = pgEnum("app_status", ["active", "inactive", "archived", "deleted"]);

export const standardFields = {
  id: text("id").primaryKey(), // Using string ID for flexibility (e.g. UUID or nanoid)
  status: text("status").default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
};
