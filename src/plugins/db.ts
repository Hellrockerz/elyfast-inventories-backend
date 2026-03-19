import { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "path";
import { db, pool } from "../database";

export default fp(async (fastify: FastifyInstance) => {
  try {
    // Verify connection
    await db.execute(sql`SELECT 1`);
    fastify.log.info("Database connection verified");

    // Run migrations
    fastify.log.info("Running database migrations...");
    await migrate(db as any, { 
      migrationsFolder: path.join(__dirname, "../database/migrations") 
    });
    fastify.log.info("Database migrations completed successfully");

  } catch (err) {
    fastify.log.error(err, "Database connection or migration failed");
    throw err; // Prevent server from starting if DB is unreachable or migration fails
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
