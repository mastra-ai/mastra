import { BetterAuthOptions } from "@better-auth/core";
import { DBAdapter, DBAdapterDebugLogOption } from "@better-auth/core/db/adapter";

//#region src/adapters/prisma-adapter/prisma-adapter.d.ts
interface PrismaConfig {
  /**
   * Database provider.
   */
  provider: "sqlite" | "cockroachdb" | "mysql" | "postgresql" | "sqlserver" | "mongodb";
  /**
   * Enable debug logs for the adapter
   *
   * @default false
   */
  debugLogs?: DBAdapterDebugLogOption | undefined;
  /**
   * Use plural table names
   *
   * @default false
   */
  usePlural?: boolean | undefined;
  /**
   * Whether to execute multiple operations in a transaction.
   *
   * If the database doesn't support transactions,
   * set this to `false` and operations will be executed sequentially.
   * @default false
   */
  transaction?: boolean | undefined;
}
interface PrismaClient {}
declare const prismaAdapter: (prisma: PrismaClient, config: PrismaConfig) => (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
//#endregion
export { PrismaConfig, prismaAdapter };