/**
 * Seed the default promo code FREE60 into the database
 * 
 * Usage: npx ts-node src/scripts/seed-promo.ts
 */
import "dotenv/config";
import { db, pool } from "../database";
import { promoCodes } from "../database/schema";
import { eq } from "drizzle-orm";

async function seedPromo(code: string, daysGranted: number, usageLimit: number) {
  try {
    // Check if FREE60 already exists
    const existing = await db.select().from(promoCodes).where(eq(promoCodes.code, code)).limit(1);

    if (existing.length > 0) {
      console.log("ℹ️  Promo code " + code + " already exists.");
    } else {
      await db.insert(promoCodes).values({
        code: code || "FREE60",
        daysGranted: daysGranted || 60,
        usageLimit: usageLimit || 10000,
        currentUsage: 0,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("✅ Promo code " + code + " created (" + daysGranted + " days free trial).");
    }

    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("❌ Failed to seed promo code:", err);
    await pool.end();
    process.exit(1);
  }
}

seedPromo(process.argv[2], Number(process.argv[3]), Number(process.argv[4]));