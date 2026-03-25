import { FastifyReply, FastifyRequest } from "fastify";
import { SyncService } from "./sync.service";
import { ShopService } from "../shops/shops.service";

export class SyncController {
  constructor(
    private syncService: SyncService,
    private shopService: ShopService
  ) {}

  async syncMutations(request: FastifyRequest, reply: FastifyReply) {
    const { mutations, shopId: shopUuid, deviceId } = request.body as {
      mutations: any[];
      shopId: string;
      deviceId: string;
    };

    if (!shopUuid) return reply.status(400).send({ error: "shopId is required" });
    if (!mutations || !Array.isArray(mutations)) return reply.status(400).send({ error: "mutations array is required" });

    try {
      const shop = await this.shopService.getShopByUuid(shopUuid);
      if (!shop) return reply.status(404).send({ error: "Shop not found" });

      const results = await this.syncService.processMutations(mutations, shop.id, deviceId || 'unknown');
      return { results };
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: "Sync processing failed" });
    }
  }
}
