import type { Config } from "drizzle-kit";

export default {
  schema: "./src/database/schema/index.ts",
  out: "./src/database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "41d9e2aa7cbc4ee79f2c71f4741a4be1",
    database: process.env.DB_NAME || "elyfast_inventory",
    ssl: "require",
  },
} satisfies Config;
