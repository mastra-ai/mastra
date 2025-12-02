import { BetterAuthOptions } from "@better-auth/core";
import { Db, MongoClient } from "mongodb";
import { DBAdapter, DBAdapterDebugLogOption } from "@better-auth/core/db/adapter";

//#region src/adapters/mongodb-adapter/mongodb-adapter.d.ts
interface MongoDBAdapterConfig {
  /**
   * MongoDB client instance
   * If not provided, Database transactions won't be enabled.
   */
  client?: MongoClient | undefined;
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
declare const mongodbAdapter: (db: Db, config?: MongoDBAdapterConfig | undefined) => (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
//#endregion
export { MongoDBAdapterConfig, mongodbAdapter };