import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:u02BzlnMUEr6R6IEZj4b@elyfast-inventory-db.cp2ewegkofq6.ap-south-1.rds.amazonaws.com:5432/elyfast-inventory-db",
  // ssl: { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle database client", err);
});

export const db = drizzle(pool, { schema });
