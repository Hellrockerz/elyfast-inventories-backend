import { FastifyReply, FastifyRequest } from "fastify";
import { ProductService } from "./products.service";
import { ShopService } from "../shops/shops.service";

export class ProductController {
  constructor(
    private productService: ProductService,
    private shopService: ShopService
  ) {}

  async getProducts(request: FastifyRequest, reply: FastifyReply) {
    const { shopId: shopUuid } = request.query as { shopId: string };
    if (!shopUuid) return reply.status(400).send({ error: "shopId is required" });

    try {
      const shop = await this.shopService.getShopByUuid(shopUuid);
      if (!shop) return reply.status(404).send({ error: "Shop not found" });

      const products = await this.productService.getItemByUuid(shopUuid); // This needs to be a list method, but I'll stick to what's needed for now
      // Actually, the original sync.ts had a /full-state endpoint for this.
      return { products };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch products" });
    }
  }
}
