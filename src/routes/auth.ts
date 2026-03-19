import { FastifyInstance } from "fastify";
import { db } from "../database";
import { shops } from "../database/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function authRoutes(fastify: FastifyInstance) {
  // Check if shop exists for a given ownerId (Firebase UID)
  fastify.get("/check/:ownerId", async (request, reply) => {
    const { ownerId } = request.params as { ownerId: string };
    
    try {
      const shop = await db.select().from(shops).where(eq(shops.ownerId, ownerId)).limit(1);
      
      if (shop.length > 0) {
        return { 
          exists: true, 
          shopId: shop[0].id, 
          shopName: shop[0].name,
          ownerName: shop[0].ownerName 
        };
      }
      
      return { exists: false };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Internal Server Error" });
    }
  });

  // Register a new shop
  fastify.post("/register", async (request, reply) => {
    const { ownerId, name, ownerName, businessType, phone, address } = request.body as any;

    if (!ownerId || !name) {
      return reply.status(400).send({ status: "error", message: "Missing required fields" });
    }

    try {
      const id = uuidv4();
      await db.insert(shops).values({
        id,
        ownerId,
        name,
        ownerName,
        businessType: businessType || "pharmacy",
        phone,
        address,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { status: "success", shopId: id };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ status: "error", message: "Failed to register shop" });
    }
  });
}
