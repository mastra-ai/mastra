import { BetterAuthOptions } from "@better-auth/core";
import { DBAdapter, DBAdapterDebugLogOption } from "@better-auth/core/db/adapter";

//#region src/adapters/drizzle-adapter/drizzle-adapter.d.ts
interface DB {
  [key: string]: any;
}
interface DrizzleAdapterConfig {
  /**
   * The schema object that defines the tables and fields
   */
  schema?: Record<string, any> | undefined;
  /**
   * The database provider
   */
  provider: "pg" | "mysql" | "sqlite";
  /**
   * If the table names in the schema are plural
   * set this to true. For example, if the schema
   * has an object with a key "users" instead of "user"
   */
  usePlural?: boolean | undefined;
  /**
   * Enable debug logs for the adapter
   *
   * @default false
   */
  debugLogs?: DBAdapterDebugLogOption | undefined;
  /**
   * By default snake case is used for table and field names
   * when the CLI is used to generate the schema. If you want
   * to use camel case, set this to true.
   * @default false
   */
  camelCase?: boolean | undefined;
  /**
   * Whether to execute multiple operations in a transaction.
   *
   * If the database doesn't support transactions,
   * set this to `false` and operations will be executed sequentially.
   * @default false
   */
  transaction?: boolean | undefined;
}
declare const drizzleAdapter: (db: DB, config: DrizzleAdapterConfig) => (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
//#endregion
export { DB, DrizzleAdapterConfig, drizzleAdapter };