import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import { registerRoutes } from "../routes";
import dbPlugin from "../plugins/db";

const fastify = Fastify({
  logger: {
    transport:
      process.env.NODE_ENV === "production"
        ? undefined
        : {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          },
  },
});

async function bootstrap() {
  try {
    // Plugins
    await fastify.register(cors);
    await fastify.register(helmet);
    await fastify.register(dbPlugin);
    await fastify.register(jwt, {
      secret: process.env.JWT_SECRET || "super-secret-key",
    });

    // Routes
    await fastify.register(registerRoutes, { prefix: "/api" });

    const port = Number(process.env.PORT) || 3005;
    await fastify.listen({ port, host: "0.0.0.0" });
    
    console.log(`Server listening on http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
