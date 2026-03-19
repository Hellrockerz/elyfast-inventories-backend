import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:41d9e2aa7cbc4ee79f2c71f4741a4be1@localhost:5432/elyfast_inventory",
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle database client", err);
});

export const db = drizzle(pool, { schema });
