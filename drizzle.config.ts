import type { Config } from "drizzle-kit";

export default {
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL || "postgres://postgres:41d9e2aa7cbc4ee79f2c71f4741a4be1@localhost:5432/elyfast_inventory",
  },
} satisfies Config;
