import { eq, isNull, and, SQL } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

/**
 * Utility to handle soft deletes in Drizzle ORM.
 */
export const withSoftDelete = <T extends PgTable & { deletedAt: any }>(
  table: T,
  condition?: SQL
) => {
  const softDeleteCondition = isNull(table.deletedAt);
  return condition ? and(softDeleteCondition, condition) : softDeleteCondition;
};

/**
 * Helper to perform a soft delete update.
 */
export const softDelete = async (db: any, table: any, id: string) => {
  return db
    .update(table)
    .set({ 
      deletedAt: new Date(),
      status: 'deleted'
    })
    .where(eq(table.id, id));
};
