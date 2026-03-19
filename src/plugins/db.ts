import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { sql } from "drizzle-orm";
import { db, pool } from "../database";

export default fp(async (fastify: FastifyInstance) => {
  try {
    // Verify connection
    await db.execute(sql`SELECT 1`);
    fastify.log.info("Database connection verified");
  } catch (err) {
    fastify.log.error(err, "Database connection failed");
    throw err; // Prevent server from starting if DB is unreachable
  }

  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    fastify.log.info("Closing database pool");
    await pool.end();
  });
});

declare module "fastify" {
  interface FastifyInstance {
    db: typeof db;
  }
}
