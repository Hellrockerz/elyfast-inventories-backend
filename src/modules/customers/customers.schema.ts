import { pgTable, varchar, integer } from "drizzle-orm/pg-core";
import { standardFields } from "../../database/schema/standard-fields";
import { shops } from "../shops/shops.schema";

export const customers = pgTable("customers", {
  ...standardFields,
  shopId: integer("shop_id").references(() => shops.id).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: varchar("address", { length: 500 }),
});
