import { FastifyInstance } from "fastify";
import { ProductController } from "./products.controller";
import { ProductService } from "./products.service";
import { ShopService } from "../shops/shops.service";

export async function productRoutes(fastify: FastifyInstance) {
  const productService = new ProductService(fastify.db);
  const shopService = new ShopService(fastify.db);
  const controller = new ProductController(productService, shopService);

  fastify.get("/", (req, rep) => controller.getProducts(req, rep));
}
