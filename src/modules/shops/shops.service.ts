import { eq } from "drizzle-orm";
import { shops } from "./shops.schema";

export class ShopService {
  constructor(private db: any) {}

  async getShopByUuid(uuid: string) {
    if (!uuid) return null;
    // If uuid is numeric, it might already be the IntId
    if (!isNaN(Number(uuid)) && uuid.length < 10) {
        const id = Number(uuid);
        const shop = await this.db.select().from(shops).where(eq(shops.id, id)).limit(1);
        return shop[0] || null;
    }
    
    const shop = await this.db.select().from(shops).where(eq(shops.uuid, uuid)).limit(1);
    return shop[0] || null;
  }

  async getShopIntId(uuid: string) {
    const shop = await this.getShopByUuid(uuid);
    return shop?.id || null;
  }
}
