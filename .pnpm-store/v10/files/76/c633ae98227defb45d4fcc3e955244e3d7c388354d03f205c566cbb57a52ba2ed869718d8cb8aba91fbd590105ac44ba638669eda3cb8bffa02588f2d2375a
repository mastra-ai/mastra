import { i as Logger, o as createLogger } from "./index-CdubV7uy.mjs";
import * as z from "zod";
import { BetterFetch, BetterFetchOption, BetterFetchPlugin } from "@better-fetch/fetch";
import * as jose0 from "jose";
import * as better_call0 from "better-call";
import { CookieOptions, Endpoint, EndpointContext, EndpointOptions, InputContext, Middleware } from "better-call";
import { StandardSchemaV1, StandardSchemaV1 as StandardSchemaV1$1 } from "@standard-schema/spec";
import { Database } from "bun:sqlite";
import { DatabaseSync } from "node:sqlite";
import { Dialect, Kysely, Migration, MysqlPool, PostgresPool, SqliteDatabase } from "kysely";
import { Atom, WritableAtom } from "nanostores";

//#region src/db/type.d.ts
type DBPreservedModels = "user" | "account" | "session" | "verification" | "rate-limit" | "organization" | "member" | "invitation" | "jwks" | "passkey" | "two-factor";
type DBFieldType = "string" | "number" | "boolean" | "date" | "json" | `${"string" | "number"}[]` | Array<LiteralString>;
type DBPrimitive = string | number | boolean | Date | null | undefined | string[] | number[] | (Record<string, unknown> | unknown[]);
type DBFieldAttributeConfig = {
  /**
   * If the field should be required on a new record.
   * @default true
   */
  required?: boolean | undefined;
  /**
   * If the value should be returned on a response body.
   * @default true
   */
  returned?: boolean | undefined;
  /**
   * If a value should be provided when creating a new record.
   * @default true
   */
  input?: boolean | undefined;
  /**
   * Default value for the field
   *
   * Note: This will not create a default value on the database level. It will only
   * be used when creating a new record.
   */
  defaultValue?: (DBPrimitive | (() => DBPrimitive)) | undefined;
  /**
   * Update value for the field
   *
   * Note: This will create an onUpdate trigger on the database level for supported adapters.
   * It will be called when updating a record.
   */
  onUpdate?: (() => DBPrimitive) | undefined;
  /**
   * transform the value before storing it.
   */
  transform?: {
    input?: (value: DBPrimitive) => DBPrimitive | Promise<DBPrimitive>;
    output?: (value: DBPrimitive) => DBPrimitive | Promise<DBPrimitive>;
  } | undefined;
  /**
   * Reference to another model.
   */
  references?: {
    /**
     * The model to reference.
     */
    model: string;
    /**
     * The field on the referenced model.
     */
    field: string;
    /**
     * The action to perform when the reference is deleted.
     * @default "cascade"
     */
    onDelete?: "no action" | "restrict" | "cascade" | "set null" | "set default";
  } | undefined;
  unique?: boolean | undefined;
  /**
   * If the field should be a bigint on the database instead of integer.
   */
  bigint?: boolean | undefined;
  /**
   * A zod schema to validate the value.
   */
  validator?: {
    input?: StandardSchemaV1;
    output?: StandardSchemaV1;
  } | undefined;
  /**
   * The name of the field on the database.
   */
  fieldName?: string | undefined;
  /**
   * If the field should be sortable.
   *
   * applicable only for `text` type.
   * It's useful to mark fields varchar instead of text.
   */
  sortable?: boolean | undefined;
  /**
   * If the field should be indexed.
   * @default false
   */
  index?: boolean | undefined;
};
type DBFieldAttribute<T extends DBFieldType = DBFieldType> = {
  type: T;
} & DBFieldAttributeConfig;
type BetterAuthDBSchema = Record<string, {
  /**
   * The name of the table in the database
   */
  modelName: string;
  /**
   * The fields of the table
   */
  fields: Record<string, DBFieldAttribute>;
  /**
   * Whether to disable migrations for this table
   * @default false
   */
  disableMigrations?: boolean | undefined;
  /**
   * The order of the table
   */
  order?: number | undefined;
}>;
interface SecondaryStorage {
  /**
   *
   * @param key - Key to get
   * @returns - Value of the key
   */
  get: (key: string) => Promise<unknown> | unknown;
  set: (
  /**
   * Key to store
   */
  key: string,
  /**
   * Value to store
   */
  value: string,
  /**
   * Time to live in seconds
   */
  ttl?: number | undefined) => Promise<void | null | unknown> | void;
  /**
   *
   * @param key - Key to delete
   */
  delete: (key: string) => Promise<void | null | string> | void;
}
//#endregion
//#region src/db/plugin.d.ts
type BetterAuthPluginDBSchema = { [table in string]: {
  fields: {
    [field: string]: DBFieldAttribute;
  };
  disableMigration?: boolean | undefined;
  modelName?: string | undefined;
} };
//#endregion
//#region src/db/schema/account.d.ts
declare const accountSchema: z.ZodObject<{
  id: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
  providerId: z.ZodString;
  accountId: z.ZodString;
  userId: z.ZodCoercedString<unknown>;
  accessToken: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  refreshToken: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  idToken: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  accessTokenExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
  refreshTokenExpiresAt: z.ZodOptional<z.ZodNullable<z.ZodDate>>;
  scope: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  password: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * Account schema type used by better-auth, note that it's possible that account could have additional fields
 *
 * todo: we should use generics to extend this type with additional fields from plugins and options in the future
 */
type Account = z.infer<typeof accountSchema>;
//#endregion
//#region src/db/schema/rate-limit.d.ts
declare const rateLimitSchema: z.ZodObject<{
  key: z.ZodString;
  count: z.ZodNumber;
  lastRequest: z.ZodNumber;
}, z.core.$strip>;
/**
 * Rate limit schema type used by better-auth for rate limiting
 */
type RateLimit = z.infer<typeof rateLimitSchema>;
//#endregion
//#region src/db/schema/session.d.ts
declare const sessionSchema: z.ZodObject<{
  id: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
  userId: z.ZodCoercedString<unknown>;
  expiresAt: z.ZodDate;
  token: z.ZodString;
  ipAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
  userAgent: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * Session schema type used by better-auth, note that it's possible that session could have additional fields
 *
 * todo: we should use generics to extend this type with additional fields from plugins and options in the future
 */
type Session = z.infer<typeof sessionSchema>;
//#endregion
//#region src/db/schema/shared.d.ts
declare const coreSchema: z.ZodObject<{
  id: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
}, z.core.$strip>;
//#endregion
//#region src/db/schema/user.d.ts
declare const userSchema: z.ZodObject<{
  id: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
  email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
  emailVerified: z.ZodDefault<z.ZodBoolean>;
  name: z.ZodString;
  image: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
/**
 * User schema type used by better-auth, note that it's possible that user could have additional fields
 *
 * todo: we should use generics to extend this type with additional fields from plugins and options in the future
 */
type User = z.infer<typeof userSchema>;
//#endregion
//#region src/db/schema/verification.d.ts
declare const verificationSchema: z.ZodObject<{
  id: z.ZodString;
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
  value: z.ZodString;
  expiresAt: z.ZodDate;
  identifier: z.ZodString;
}, z.core.$strip>;
/**
 * Verification schema type used by better-auth, note that it's possible that verification could have additional fields
 *
 * todo: we should use generics to extend this type with additional fields from plugins and options in the future
 */
type Verification = z.infer<typeof verificationSchema>;
//#endregion
//#region src/db/index.d.ts
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type AuthPluginSchema = BetterAuthPluginDBSchema;
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type FieldAttribute = DBFieldAttribute;
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type FieldAttributeConfig = DBFieldAttributeConfig;
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type FieldType = DBFieldType;
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type Primitive$1 = DBPrimitive;
/**
 * @deprecated Backport for 1.3.x, we will remove this in 1.4.x
 */
type BetterAuthDbSchema = BetterAuthDBSchema;
//#endregion
//#region src/db/adapter/index.d.ts
type DBAdapterDebugLogOption = boolean | {
  /**
   * Useful when you want to log only certain conditions.
   */
  logCondition?: (() => boolean) | undefined;
  create?: boolean | undefined;
  update?: boolean | undefined;
  updateMany?: boolean | undefined;
  findOne?: boolean | undefined;
  findMany?: boolean | undefined;
  delete?: boolean | undefined;
  deleteMany?: boolean | undefined;
  count?: boolean | undefined;
} | {
  /**
   * Only used for adapter tests to show debug logs if a test fails.
   *
   * @deprecated Not actually deprecated. Doing this for IDEs to show this option at the very bottom and stop end-users from using this.
   */
  isRunningAdapterTests: boolean;
};
type DBAdapterSchemaCreation = {
  /**
   * Code to be inserted into the file
   */
  code: string;
  /**
   * Path to the file, including the file name and extension.
   * Relative paths are supported, with the current working directory of the developer's project as the base.
   */
  path: string;
  /**
   * Append the file if it already exists.
   * Note: This will not apply if `overwrite` is set to true.
   */
  append?: boolean | undefined;
  /**
   * Overwrite the file if it already exists
   */
  overwrite?: boolean | undefined;
};
interface DBAdapterFactoryConfig<Options extends BetterAuthOptions = BetterAuthOptions> {
  /**
   * Use plural table names.
   *
   * All tables will be named with an `s` at the end.
   *
   * @default false
   */
  usePlural?: boolean | undefined;
  /**
   * Enable debug logs.
   *
   * @default false
   */
  debugLogs?: DBAdapterDebugLogOption | undefined;
  /**
   * Name of the adapter.
   *
   * This is used to identify the adapter in the debug logs.
   *
   * @default `adapterId`
   */
  adapterName?: string | undefined;
  /**
   * Adapter id
   */
  adapterId: string;
  /**
   * If the database supports numeric ids, set this to `true`.
   *
   * @default true
   */
  supportsNumericIds?: boolean | undefined;
  /**
   * If the database supports natively generating UUIDs, set this to `true`.
   *
   * @default false
   */
  supportsUUIDs?: boolean | undefined;
  /**
   * If the database doesn't support JSON columns, set this to `false`.
   *
   * We will handle the translation between using `JSON` columns, and saving `string`s to the database.
   *
   * @default false
   */
  supportsJSON?: boolean | undefined;
  /**
   * If the database doesn't support dates, set this to `false`.
   *
   * We will handle the translation between using `Date` objects, and saving `string`s to the database.
   *
   * @default true
   */
  supportsDates?: boolean | undefined;
  /**
   * If the database doesn't support booleans, set this to `false`.
   *
   * We will handle the translation between using `boolean`s, and saving `0`s and `1`s to the database.
   *
   * @default true
   */
  supportsBooleans?: boolean | undefined;
  /**
   * Execute multiple operations in a transaction.
   *
   * If the database doesn't support transactions, set this to `false` and operations will be executed sequentially.
   *
   * @default false
   */
  transaction?: (false | (<R>(callback: (trx: DBTransactionAdapter<Options>) => Promise<R>) => Promise<R>)) | undefined;
  /**
   * Disable id generation for the `create` method.
   *
   * This is useful for databases that don't support custom id values and would auto-generate them for you.
   *
   * @default false
   */
  disableIdGeneration?: boolean | undefined;
  /**
   * Map the keys of the input data.
   *
   * This is useful for databases that expect a different key name for a given situation.
   *
   * For example, MongoDB uses `_id` while in Better-Auth we use `id`.
   *
   *
   * @example
   * Each key represents the old key to replace.
   * The value represents the new key
   *
   * This can be a partial object that only transforms some keys.
   *
   * ```ts
   * mapKeysTransformInput: {
   *  id: "_id" // We want to replace `id` to `_id` to save into MongoDB
   * }
   * ```
   */
  mapKeysTransformInput?: Record<string, string> | undefined;
  /**
   * Map the keys of the output data.
   *
   * This is useful for databases that expect a different key name for a given situation.
   *
   * For example, MongoDB uses `_id` while in Better-Auth we use `id`.
   *
   * @example
   * Each key represents the old key to replace.
   * The value represents the new key
   *
   * This can be a partial object that only transforms some keys.
   *
   * ```ts
   * mapKeysTransformOutput: {
   *  _id: "id" // In MongoDB, we save `id` as `_id`. So we want to replace `_id` with `id` when we get the data back.
   * }
   * ```
   */
  mapKeysTransformOutput?: Record<string, string> | undefined;
  /**
   * Custom transform input function.
   *
   * This function is used to transform the input data before it is saved to the database.
   */
  customTransformInput?: ((props: {
    data: any;
    /**
     * The fields of the model.
     */
    fieldAttributes: DBFieldAttribute;
    /**
     * The field to transform.
     */
    field: string;
    /**
     * The action which was called from the adapter.
     */
    action: "create" | "update" | "findOne" | "findMany";
    /**
     * The model name.
     */
    model: string;
    /**
     * The schema of the user's Better-Auth instance.
     */
    schema: BetterAuthDBSchema;
    /**
     * The options of the user's Better-Auth instance.
     */
    options: Options;
  }) => any) | undefined;
  /**
   * Custom transform output function.
   *
   * This function is used to transform the output data before it is returned to the user.
   */
  customTransformOutput?: ((props: {
    data: any;
    /**
     * The fields of the model.
     */
    fieldAttributes: DBFieldAttribute;
    /**
     * The field to transform.
     */
    field: string;
    /**
     * The fields to select.
     */
    select: string[];
    /**
     * The model name.
     */
    model: string;
    /**
     * The schema of the user's Better-Auth instance.
     */
    schema: BetterAuthDBSchema;
    /**
     * The options of the user's Better-Auth instance.
     */
    options: Options;
  }) => any) | undefined;
  /**
   * Custom ID generator function.
   *
   * By default, we can handle ID generation for you, however if the database your adapter is for only supports a specific custom id generation,
   * then you can use this function to generate your own IDs.
   *
   *
   * Notes:
   * - If the user enabled `useNumberId` or `generateId` set to `serial`, then this option will be ignored. Unless this adapter config has `supportsNumericIds` set to `false`.
   * - If `generateId` is `false` in the user's Better-Auth config, then this option will be ignored.
   * - If `generateId` is a function, then it will override this option.
   *
   * @example
   *
   * ```ts
   * customIdGenerator: ({ model }) => {
   *  return "my-super-unique-id";
   * }
   * ```
   */
  customIdGenerator?: ((props: {
    model: string;
  }) => string) | undefined;
  /**
   * Whether to disable the transform output.
   * Do not use this option unless you know what you are doing.
   * @default false
   */
  disableTransformOutput?: boolean | undefined;
  /**
   * Whether to disable the transform input.
   * Do not use this option unless you know what you are doing.
   * @default false
   */
  disableTransformInput?: boolean | undefined;
  /**
   * Whether to disable the transform join.
   * Do not use this option unless you know what you are doing.
   * @default false
   */
  disableTransformJoin?: boolean | undefined;
}
type Where = {
  /**
   * @default eq
   */
  operator?: ("eq" | "ne" | "lt" | "lte" | "gt" | "gte" | "in" | "not_in" | "contains" | "starts_with" | "ends_with") | undefined;
  value: string | number | boolean | string[] | number[] | Date | null;
  field: string;
  /**
   * @default AND
   */
  connector?: ("AND" | "OR") | undefined;
};
/**
 * JoinOption configuration for relational queries.
 *
 * Allows you to join related tables/models in a single query operation.
 * Each key represents the name of the joined table/model, and the value
 * configures how the join should be performed.
 */
type JoinOption = {
  [model: string]: boolean | {
    limit?: number;
  };
};
/**
 * Once `JoinOption` has gone through the adapter factory, it will be transformed into a `JoinConfig`.
 */
type JoinConfig = {
  [model: string]: {
    /**
     * The joining column names.
     */
    on: {
      /**
       * Column name from the main table
       */
      from: string;
      /**
       * Column name from the joined table
       */
      to: string;
    };
    /**
     * Limit the number of rows to return.
     *
     * If the relation has `unique` constraint, then this option will be ignored and limit will be set to 1.
     *
     * @default 100
     */
    limit?: number;
    /**
     * The relation type. Determines the ouput joined model data.
     *
     * `one-to-one` would have a single object in the output.
     * `one-to-many` would have an array of objects in the output.
     * `many-to-many` would have an array of objects in the output.
     *
     * @default "one-to-many"
     */
    relation?: "one-to-one" | "one-to-many" | "many-to-many";
  };
};
type DBTransactionAdapter<Options extends BetterAuthOptions = BetterAuthOptions> = Omit<DBAdapter<Options>, "transaction">;
type DBAdapter<Options extends BetterAuthOptions = BetterAuthOptions> = {
  id: string;
  create: <T extends Record<string, any>, R = T>(data: {
    model: string;
    data: Omit<T, "id">;
    select?: string[] | undefined;
    /**
     * By default, any `id` provided in `data` will be ignored.
     *
     * If you want to force the `id` to be the same as the `data.id`, set this to `true`.
     */
    forceAllowId?: boolean | undefined;
  }) => Promise<R>;
  findOne: <T>(data: {
    model: string;
    where: Where[];
    select?: string[] | undefined;
    join?: JoinOption | undefined;
  }) => Promise<T | null>;
  findMany: <T>(data: {
    model: string;
    where?: Where[] | undefined;
    limit?: number | undefined;
    sortBy?: {
      field: string;
      direction: "asc" | "desc";
    } | undefined;
    offset?: number | undefined;
    join?: JoinOption | undefined;
  }) => Promise<T[]>;
  count: (data: {
    model: string;
    where?: Where[] | undefined;
  }) => Promise<number>;
  /**
   * ⚠︎ Update may not return the updated data
   * if multiple where clauses are provided
   */
  update: <T>(data: {
    model: string;
    where: Where[];
    update: Record<string, any>;
  }) => Promise<T | null>;
  updateMany: (data: {
    model: string;
    where: Where[];
    update: Record<string, any>;
  }) => Promise<number>;
  delete: <T>(data: {
    model: string;
    where: Where[];
  }) => Promise<void>;
  deleteMany: (data: {
    model: string;
    where: Where[];
  }) => Promise<number>;
  /**
   * Execute multiple operations in a transaction.
   * If the adapter doesn't support transactions, operations will be executed sequentially.
   */
  transaction: <R>(callback: (trx: DBTransactionAdapter<Options>) => Promise<R>) => Promise<R>;
  /**
   *
   * @param options
   * @param file - file path if provided by the user
   */
  createSchema?: ((options: Options, file?: string) => Promise<DBAdapterSchemaCreation>) | undefined;
  options?: ({
    adapterConfig: DBAdapterFactoryConfig<Options>;
  } & CustomAdapter["options"]) | undefined;
};
type CleanedWhere = Required<Where>;
interface CustomAdapter {
  create: <T extends Record<string, any>>({
    data,
    model,
    select
  }: {
    model: string;
    data: T;
    select?: string[] | undefined;
  }) => Promise<T>;
  update: <T>(data: {
    model: string;
    where: CleanedWhere[];
    update: T;
  }) => Promise<T | null>;
  updateMany: (data: {
    model: string;
    where: CleanedWhere[];
    update: Record<string, any>;
  }) => Promise<number>;
  findOne: <T>({
    model,
    where,
    select,
    join
  }: {
    model: string;
    where: CleanedWhere[];
    select?: string[] | undefined;
    join?: JoinConfig | undefined;
  }) => Promise<T | null>;
  findMany: <T>({
    model,
    where,
    limit,
    sortBy,
    offset,
    join
  }: {
    model: string;
    where?: CleanedWhere[] | undefined;
    limit: number;
    sortBy?: {
      field: string;
      direction: "asc" | "desc";
    } | undefined;
    offset?: number | undefined;
    join?: JoinConfig | undefined;
  }) => Promise<T[]>;
  delete: ({
    model,
    where
  }: {
    model: string;
    where: CleanedWhere[];
  }) => Promise<void>;
  deleteMany: ({
    model,
    where
  }: {
    model: string;
    where: CleanedWhere[];
  }) => Promise<number>;
  count: ({
    model,
    where
  }: {
    model: string;
    where?: CleanedWhere[] | undefined;
  }) => Promise<number>;
  createSchema?: ((props: {
    /**
     * The file the user may have passed in to the `generate` command as the expected schema file output path.
     */
    file?: string;
    /**
     * The tables from the user's Better-Auth instance schema.
     */
    tables: BetterAuthDBSchema;
  }) => Promise<DBAdapterSchemaCreation>) | undefined;
  /**
   * Your adapter's options.
   */
  options?: Record<string, any> | undefined;
}
interface DBAdapterInstance<Options extends BetterAuthOptions = BetterAuthOptions> {
  (options: BetterAuthOptions): DBAdapter<Options>;
}
//#endregion
//#region src/oauth2/oauth-provider.d.ts
interface OAuth2Tokens {
  tokenType?: string | undefined;
  accessToken?: string | undefined;
  refreshToken?: string | undefined;
  accessTokenExpiresAt?: Date | undefined;
  refreshTokenExpiresAt?: Date | undefined;
  scopes?: string[] | undefined;
  idToken?: string | undefined;
  /**
   * Raw token response from the provider.
   * Preserves provider-specific fields that are not part of the standard OAuth2 token response.
   */
  raw?: Record<string, unknown> | undefined;
}
type OAuth2UserInfo = {
  id: string | number;
  name?: string | undefined;
  email?: (string | null) | undefined;
  image?: string | undefined;
  emailVerified: boolean;
};
interface OAuthProvider<T extends Record<string, any> = Record<string, any>, O extends Record<string, any> = Partial<ProviderOptions>> {
  id: LiteralString;
  createAuthorizationURL: (data: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }) => Promise<URL> | URL;
  name: string;
  validateAuthorizationCode: (data: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  getUserInfo: (token: OAuth2Tokens & {
    /**
     * The user object from the provider
     * This is only available for some providers like Apple
     */
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }) => Promise<{
    user: OAuth2UserInfo;
    data: T;
  } | null>;
  /**
   * Custom function to refresh a token
   */
  refreshAccessToken?: ((refreshToken: string) => Promise<OAuth2Tokens>) | undefined;
  revokeToken?: ((token: string) => Promise<void>) | undefined;
  /**
   * Verify the id token
   * @param token - The id token
   * @param nonce - The nonce
   * @returns True if the id token is valid, false otherwise
   */
  verifyIdToken?: ((token: string, nonce?: string) => Promise<boolean>) | undefined;
  /**
   * Disable implicit sign up for new users. When set to true for the provider,
   * sign-in need to be called with with requestSignUp as true to create new users.
   */
  disableImplicitSignUp?: boolean | undefined;
  /**
   * Disable sign up for new users.
   */
  disableSignUp?: boolean | undefined;
  /**
   * Options for the provider
   */
  options?: O | undefined;
}
type ProviderOptions<Profile$1 extends Record<string, any> = any> = {
  /**
   * The client ID of your application.
   *
   * This is usually a string but can be any type depending on the provider.
   */
  clientId?: unknown | undefined;
  /**
   * The client secret of your application
   */
  clientSecret?: string | undefined;
  /**
   * The scopes you want to request from the provider
   */
  scope?: string[] | undefined;
  /**
   * Remove default scopes of the provider
   */
  disableDefaultScope?: boolean | undefined;
  /**
   * The redirect URL for your application. This is where the provider will
   * redirect the user after the sign in process. Make sure this URL is
   * whitelisted in the provider's dashboard.
   */
  redirectURI?: string | undefined;
  /**
   * The client key of your application
   * Tiktok Social Provider uses this field instead of clientId
   */
  clientKey?: string | undefined;
  /**
   * Disable provider from allowing users to sign in
   * with this provider with an id token sent from the
   * client.
   */
  disableIdTokenSignIn?: boolean | undefined;
  /**
   * verifyIdToken function to verify the id token
   */
  verifyIdToken?: ((token: string, nonce?: string) => Promise<boolean>) | undefined;
  /**
   * Custom function to get user info from the provider
   */
  getUserInfo?: ((token: OAuth2Tokens) => Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  }>) | undefined;
  /**
   * Custom function to refresh a token
   */
  refreshAccessToken?: ((refreshToken: string) => Promise<OAuth2Tokens>) | undefined;
  /**
   * Custom function to map the provider profile to a
   * user.
   */
  mapProfileToUser?: ((profile: Profile$1) => {
    id?: string;
    name?: string;
    email?: string | null;
    image?: string;
    emailVerified?: boolean;
    [key: string]: any;
  } | Promise<{
    id?: string;
    name?: string;
    email?: string | null;
    image?: string;
    emailVerified?: boolean;
    [key: string]: any;
  }>) | undefined;
  /**
   * Disable implicit sign up for new users. When set to true for the provider,
   * sign-in need to be called with with requestSignUp as true to create new users.
   */
  disableImplicitSignUp?: boolean | undefined;
  /**
   * Disable sign up for new users.
   */
  disableSignUp?: boolean | undefined;
  /**
   * The prompt to use for the authorization code request
   */
  prompt?: ("select_account" | "consent" | "login" | "none" | "select_account consent") | undefined;
  /**
   * The response mode to use for the authorization code request
   */
  responseMode?: ("query" | "form_post") | undefined;
  /**
   * If enabled, the user info will be overridden with the provider user info
   * This is useful if you want to use the provider user info to update the user info
   *
   * @default false
   */
  overrideUserInfoOnSignIn?: boolean | undefined;
};
//#endregion
//#region src/oauth2/client-credentials-token.d.ts
declare function createClientCredentialsTokenRequest({
  options,
  scope,
  authentication,
  resource
}: {
  options: ProviderOptions & {
    clientSecret: string;
  };
  scope?: string | undefined;
  authentication?: ("basic" | "post") | undefined;
  resource?: (string | string[]) | undefined;
}): {
  body: URLSearchParams;
  headers: Record<string, any>;
};
declare function clientCredentialsToken({
  options,
  tokenEndpoint,
  scope,
  authentication,
  resource
}: {
  options: ProviderOptions & {
    clientSecret: string;
  };
  tokenEndpoint: string;
  scope: string;
  authentication?: ("basic" | "post") | undefined;
  resource?: (string | string[]) | undefined;
}): Promise<OAuth2Tokens>;
//#endregion
//#region src/oauth2/create-authorization-url.d.ts
declare function createAuthorizationURL({
  id,
  options,
  authorizationEndpoint,
  state,
  codeVerifier,
  scopes,
  claims,
  redirectURI,
  duration,
  prompt,
  accessType,
  responseType,
  display,
  loginHint,
  hd,
  responseMode,
  additionalParams,
  scopeJoiner
}: {
  id: string;
  options: ProviderOptions;
  redirectURI: string;
  authorizationEndpoint: string;
  state: string;
  codeVerifier?: string | undefined;
  scopes?: string[] | undefined;
  claims?: string[] | undefined;
  duration?: string | undefined;
  prompt?: string | undefined;
  accessType?: string | undefined;
  responseType?: string | undefined;
  display?: string | undefined;
  loginHint?: string | undefined;
  hd?: string | undefined;
  responseMode?: string | undefined;
  additionalParams?: Record<string, string> | undefined;
  scopeJoiner?: string | undefined;
}): Promise<URL>;
//#endregion
//#region src/oauth2/refresh-access-token.d.ts
declare function createRefreshAccessTokenRequest({
  refreshToken,
  options,
  authentication,
  extraParams,
  resource
}: {
  refreshToken: string;
  options: Partial<ProviderOptions>;
  authentication?: ("basic" | "post") | undefined;
  extraParams?: Record<string, string> | undefined;
  resource?: (string | string[]) | undefined;
}): {
  body: URLSearchParams;
  headers: Record<string, any>;
};
declare function refreshAccessToken({
  refreshToken,
  options,
  tokenEndpoint,
  authentication,
  extraParams
}: {
  refreshToken: string;
  options: Partial<ProviderOptions>;
  tokenEndpoint: string;
  authentication?: ("basic" | "post") | undefined;
  extraParams?: Record<string, string> | undefined;
  /** @deprecated always "refresh_token" */
  grantType?: string | undefined;
}): Promise<OAuth2Tokens>;
//#endregion
//#region src/oauth2/utils.d.ts
declare function getOAuth2Tokens(data: Record<string, any>): OAuth2Tokens;
declare function generateCodeChallenge(codeVerifier: string): Promise<string>;
//#endregion
//#region src/oauth2/validate-authorization-code.d.ts
declare function createAuthorizationCodeRequest({
  code,
  codeVerifier,
  redirectURI,
  options,
  authentication,
  deviceId,
  headers,
  additionalParams,
  resource
}: {
  code: string;
  redirectURI: string;
  options: Partial<ProviderOptions>;
  codeVerifier?: string | undefined;
  deviceId?: string | undefined;
  authentication?: ("basic" | "post") | undefined;
  headers?: Record<string, string> | undefined;
  additionalParams?: Record<string, string> | undefined;
  resource?: (string | string[]) | undefined;
}): {
  body: URLSearchParams;
  headers: Record<string, any>;
};
declare function validateAuthorizationCode({
  code,
  codeVerifier,
  redirectURI,
  options,
  tokenEndpoint,
  authentication,
  deviceId,
  headers,
  additionalParams,
  resource
}: {
  code: string;
  redirectURI: string;
  options: Partial<ProviderOptions>;
  codeVerifier?: string | undefined;
  deviceId?: string | undefined;
  tokenEndpoint: string;
  authentication?: ("basic" | "post") | undefined;
  headers?: Record<string, string> | undefined;
  additionalParams?: Record<string, string> | undefined;
  resource?: (string | string[]) | undefined;
}): Promise<OAuth2Tokens>;
declare function validateToken(token: string, jwksEndpoint: string): Promise<jose0.JWTVerifyResult<jose0.JWTPayload>>;
//#endregion
//#region src/types/cookie.d.ts
type BetterAuthCookies = {
  sessionToken: {
    name: string;
    options: CookieOptions;
  };
  sessionData: {
    name: string;
    options: CookieOptions;
  };
  accountData: {
    name: string;
    options: CookieOptions;
  };
  dontRememberToken: {
    name: string;
    options: CookieOptions;
  };
};
//#endregion
//#region src/types/helper.d.ts
type Primitive = string | number | symbol | bigint | boolean | null | undefined;
type LiteralString = "" | (string & Record<never, never>);
type LiteralUnion<LiteralType, BaseType extends Primitive> = LiteralType | (BaseType & Record<never, never>);
//#endregion
//#region src/social-providers/apple.d.ts
interface AppleProfile {
  /**
   * The subject registered claim identifies the principal that’s the subject
   * of the identity token. Because this token is for your app, the value is
   * the unique identifier for the user.
   */
  sub: string;
  /**
   * A String value representing the user's email address.
   * The email address is either the user's real email address or the proxy
   * address, depending on their status private email relay service.
   */
  email: string;
  /**
   * A string or Boolean value that indicates whether the service verifies
   * the email. The value can either be a string ("true" or "false") or a
   * Boolean (true or false). The system may not verify email addresses for
   * Sign in with Apple at Work & School users, and this claim is "false" or
   * false for those users.
   */
  email_verified: true | "true";
  /**
   * A string or Boolean value that indicates whether the email that the user
   * shares is the proxy address. The value can either be a string ("true" or
   * "false") or a Boolean (true or false).
   */
  is_private_email: boolean;
  /**
   * An Integer value that indicates whether the user appears to be a real
   * person. Use the value of this claim to mitigate fraud. The possible
   * values are: 0 (or Unsupported), 1 (or Unknown), 2 (or LikelyReal). For
   * more information, see ASUserDetectionStatus. This claim is present only
   * in iOS 14 and later, macOS 11 and later, watchOS 7 and later, tvOS 14
   * and later. The claim isn’t present or supported for web-based apps.
   */
  real_user_status: number;
  /**
   * The user’s full name in the format provided during the authorization
   * process.
   */
  name: string;
  /**
   * The URL to the user's profile picture.
   */
  picture: string;
  user?: AppleNonConformUser | undefined;
}
/**
 * This is the shape of the `user` query parameter that Apple sends the first
 * time the user consents to the app.
 * @see https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server./
 */
interface AppleNonConformUser {
  name: {
    firstName: string;
    lastName: string;
  };
  email: string;
}
interface AppleOptions extends ProviderOptions<AppleProfile> {
  clientId: string;
  appBundleIdentifier?: string | undefined;
  audience?: (string | string[]) | undefined;
}
declare const apple: (options: AppleOptions) => {
  id: "apple";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: AppleOptions;
};
declare const getApplePublicKey: (kid: string) => Promise<Uint8Array<ArrayBufferLike> | CryptoKey>;
//#endregion
//#region src/social-providers/atlassian.d.ts
interface AtlassianProfile {
  account_type?: string | undefined;
  account_id: string;
  email?: string | undefined;
  name: string;
  picture?: string | undefined;
  nickname?: string | undefined;
  locale?: string | undefined;
  extended_profile?: {
    job_title?: string;
    organization?: string;
    department?: string;
    location?: string;
  } | undefined;
}
interface AtlassianOptions extends ProviderOptions<AtlassianProfile> {
  clientId: string;
}
declare const atlassian: (options: AtlassianOptions) => {
  id: "atlassian";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: AtlassianOptions;
};
//#endregion
//#region src/social-providers/cognito.d.ts
interface CognitoProfile {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string | undefined;
  family_name?: string | undefined;
  picture?: string | undefined;
  username?: string | undefined;
  locale?: string | undefined;
  phone_number?: string | undefined;
  phone_number_verified?: boolean | undefined;
  aud: string;
  iss: string;
  exp: number;
  iat: number;
  [key: string]: any;
}
interface CognitoOptions extends ProviderOptions<CognitoProfile> {
  clientId: string;
  /**
   * The Cognito domain (e.g., "your-app.auth.us-east-1.amazoncognito.com")
   */
  domain: string;
  /**
   * AWS region where User Pool is hosted (e.g., "us-east-1")
   */
  region: string;
  userPoolId: string;
  requireClientSecret?: boolean | undefined;
}
declare const cognito: (options: CognitoOptions) => {
  id: "cognito";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: CognitoOptions;
};
declare const getCognitoPublicKey: (kid: string, region: string, userPoolId: string) => Promise<Uint8Array<ArrayBufferLike> | CryptoKey>;
//#endregion
//#region src/social-providers/discord.d.ts
interface DiscordProfile extends Record<string, any> {
  /** the user's id (i.e. the numerical snowflake) */
  id: string;
  /** the user's username, not unique across the platform */
  username: string;
  /** the user's Discord-tag */
  discriminator: string;
  /** the user's display name, if it is set  */
  global_name: string | null;
  /**
   * the user's avatar hash:
   * https://discord.com/developers/docs/reference#image-formatting
   */
  avatar: string | null;
  /** whether the user belongs to an OAuth2 application */
  bot?: boolean | undefined;
  /**
   * whether the user is an Official Discord System user (part of the urgent
   * message system)
   */
  system?: boolean | undefined;
  /** whether the user has two factor enabled on their account */
  mfa_enabled: boolean;
  /**
   * the user's banner hash:
   * https://discord.com/developers/docs/reference#image-formatting
   */
  banner: string | null;
  /** the user's banner color encoded as an integer representation of hexadecimal color code */
  accent_color: number | null;
  /**
   * the user's chosen language option:
   * https://discord.com/developers/docs/reference#locales
   */
  locale: string;
  /** whether the email on this account has been verified */
  verified: boolean;
  /** the user's email */
  email: string;
  /**
   * the flags on a user's account:
   * https://discord.com/developers/docs/resources/user#user-object-user-flags
   */
  flags: number;
  /**
   * the type of Nitro subscription on a user's account:
   * https://discord.com/developers/docs/resources/user#user-object-premium-types
   */
  premium_type: number;
  /**
   * the public flags on a user's account:
   * https://discord.com/developers/docs/resources/user#user-object-user-flags
   */
  public_flags: number;
  /** undocumented field; corresponds to the user's custom nickname */
  display_name: string | null;
  /**
   * undocumented field; corresponds to the Discord feature where you can e.g.
   * put your avatar inside of an ice cube
   */
  avatar_decoration: string | null;
  /**
   * undocumented field; corresponds to the premium feature where you can
   * select a custom banner color
   */
  banner_color: string | null;
  /** undocumented field; the CDN URL of their profile picture */
  image_url: string;
}
interface DiscordOptions extends ProviderOptions<DiscordProfile> {
  clientId: string;
  prompt?: ("none" | "consent") | undefined;
  permissions?: number | undefined;
}
declare const discord: (options: DiscordOptions) => {
  id: "discord";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): URL;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: DiscordOptions;
};
//#endregion
//#region src/social-providers/facebook.d.ts
interface FacebookProfile {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  picture: {
    data: {
      height: number;
      is_silhouette: boolean;
      url: string;
      width: number;
    };
  };
}
interface FacebookOptions extends ProviderOptions<FacebookProfile> {
  clientId: string;
  /**
   * Extend list of fields to retrieve from the Facebook user profile.
   *
   * @default ["id", "name", "email", "picture"]
   */
  fields?: string[] | undefined;
  /**
   * The config id to use when undergoing oauth
   */
  configId?: string | undefined;
}
declare const facebook: (options: FacebookOptions) => {
  id: "facebook";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI,
    loginHint
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: FacebookOptions;
};
//#endregion
//#region src/social-providers/figma.d.ts
interface FigmaProfile {
  id: string;
  email: string;
  handle: string;
  img_url: string;
}
interface FigmaOptions extends ProviderOptions<FigmaProfile> {
  clientId: string;
}
declare const figma: (options: FigmaOptions) => {
  id: "figma";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: FigmaOptions;
};
//#endregion
//#region src/social-providers/github.d.ts
interface GithubProfile {
  login: string;
  id: string;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
  name: string;
  company: string;
  blog: string;
  location: string;
  email: string;
  hireable: boolean;
  bio: string;
  twitter_username: string;
  public_repos: string;
  public_gists: string;
  followers: string;
  following: string;
  created_at: string;
  updated_at: string;
  private_gists: string;
  total_private_repos: string;
  owned_private_repos: string;
  disk_usage: string;
  collaborators: string;
  two_factor_authentication: boolean;
  plan: {
    name: string;
    space: string;
    private_repos: string;
    collaborators: string;
  };
}
interface GithubOptions extends ProviderOptions<GithubProfile> {
  clientId: string;
}
declare const github: (options: GithubOptions) => {
  id: "github";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    loginHint,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: GithubOptions;
};
//#endregion
//#region src/social-providers/microsoft-entra-id.d.ts
/**
 * @see [Microsoft Identity Platform - Optional claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/optional-claims-reference)
 */
interface MicrosoftEntraIDProfile extends Record<string, any> {
  /** Identifies the intended recipient of the token */
  aud: string;
  /** Identifies the issuer, or "authorization server" that constructs and returns the token */
  iss: string;
  /** Indicates when the authentication for the token occurred */
  iat: Date;
  /** Records the identity provider that authenticated the subject of the token */
  idp: string;
  /** Identifies the time before which the JWT can't be accepted for processing */
  nbf: Date;
  /** Identifies the expiration time on or after which the JWT can't be accepted for processing */
  exp: Date;
  /** Code hash included in ID tokens when issued with an OAuth 2.0 authorization code */
  c_hash: string;
  /** Access token hash included in ID tokens when issued with an OAuth 2.0 access token */
  at_hash: string;
  /** Internal claim used to record data for token reuse */
  aio: string;
  /** The primary username that represents the user */
  preferred_username: string;
  /** User's email address */
  email: string;
  /** Human-readable value that identifies the subject of the token */
  name: string;
  /** Matches the parameter included in the original authorize request */
  nonce: string;
  /** User's profile picture */
  picture: string;
  /** Immutable identifier for the user account */
  oid: string;
  /** Set of roles assigned to the user */
  roles: string[];
  /** Internal claim used to revalidate tokens */
  rh: string;
  /** Subject identifier - unique to application ID */
  sub: string;
  /** Tenant ID the user is signing in to */
  tid: string;
  /** Unique identifier for a session */
  sid: string;
  /** Token identifier claim */
  uti: string;
  /** Indicates if user is in at least one group */
  hasgroups: boolean;
  /** User account status in tenant (0 = member, 1 = guest) */
  acct: 0 | 1;
  /** Auth Context IDs */
  acrs: string;
  /** Time when the user last authenticated */
  auth_time: Date;
  /** User's country/region */
  ctry: string;
  /** IP address of requesting client when inside VNET */
  fwd: string;
  /** Group claims */
  groups: string;
  /** Login hint for SSO */
  login_hint: string;
  /** Resource tenant's country/region */
  tenant_ctry: string;
  /** Region of the resource tenant */
  tenant_region_scope: string;
  /** UserPrincipalName */
  upn: string;
  /** User's verified primary email addresses */
  verified_primary_email: string[];
  /** User's verified secondary email addresses */
  verified_secondary_email: string[];
  /** Whether the user's email is verified (optional claim, must be configured in app registration) */
  email_verified?: boolean | undefined;
  /** VNET specifier information */
  vnet: string;
  /** Client Capabilities */
  xms_cc: string;
  /** Whether user's email domain is verified */
  xms_edov: boolean;
  /** Preferred data location for Multi-Geo tenants */
  xms_pdl: string;
  /** User preferred language */
  xms_pl: string;
  /** Tenant preferred language */
  xms_tpl: string;
  /** Zero-touch Deployment ID */
  ztdid: string;
  /** IP Address */
  ipaddr: string;
  /** On-premises Security Identifier */
  onprem_sid: string;
  /** Password Expiration Time */
  pwd_exp: number;
  /** Change Password URL */
  pwd_url: string;
  /** Inside Corporate Network flag */
  in_corp: string;
  /** User's family name/surname */
  family_name: string;
  /** User's given/first name */
  given_name: string;
}
interface MicrosoftOptions extends ProviderOptions<MicrosoftEntraIDProfile> {
  clientId: string;
  /**
   * The tenant ID of the Microsoft account
   * @default "common"
   */
  tenantId?: string | undefined;
  /**
   * The authentication authority URL. Use the default "https://login.microsoftonline.com" for standard Entra ID or "https://<tenant-id>.ciamlogin.com" for CIAM scenarios.
   * @default "https://login.microsoftonline.com"
   */
  authority?: string | undefined;
  /**
   * The size of the profile photo
   * @default 48
   */
  profilePhotoSize?: (48 | 64 | 96 | 120 | 240 | 360 | 432 | 504 | 648) | undefined;
  /**
   * Disable profile photo
   */
  disableProfilePhoto?: boolean | undefined;
}
declare const microsoft: (options: MicrosoftOptions) => {
  id: "microsoft";
  name: string;
  createAuthorizationURL(data: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }): Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  options: MicrosoftOptions;
};
//#endregion
//#region src/social-providers/google.d.ts
interface GoogleProfile {
  aud: string;
  azp: string;
  email: string;
  email_verified: boolean;
  exp: number;
  /**
   * The family name of the user, or last name in most
   * Western languages.
   */
  family_name: string;
  /**
   * The given name of the user, or first name in most
   * Western languages.
   */
  given_name: string;
  hd?: string | undefined;
  iat: number;
  iss: string;
  jti?: string | undefined;
  locale?: string | undefined;
  name: string;
  nbf?: number | undefined;
  picture: string;
  sub: string;
}
interface GoogleOptions extends ProviderOptions<GoogleProfile> {
  clientId: string;
  /**
   * The access type to use for the authorization code request
   */
  accessType?: ("offline" | "online") | undefined;
  /**
   * The display mode to use for the authorization code request
   */
  display?: ("page" | "popup" | "touch" | "wap") | undefined;
  /**
   * The hosted domain of the user
   */
  hd?: string | undefined;
}
declare const google: (options: GoogleOptions) => {
  id: "google";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI,
    loginHint,
    display
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: GoogleOptions;
};
//#endregion
//#region src/social-providers/huggingface.d.ts
interface HuggingFaceProfile {
  sub: string;
  name: string;
  preferred_username: string;
  profile: string;
  picture: string;
  website?: string | undefined;
  email?: string | undefined;
  email_verified?: boolean | undefined;
  isPro: boolean;
  canPay?: boolean | undefined;
  orgs?: {
    sub: string;
    name: string;
    picture: string;
    preferred_username: string;
    isEnterprise: boolean | "plus";
    canPay?: boolean;
    roleInOrg?: "admin" | "write" | "contributor" | "read";
    pendingSSO?: boolean;
    missingMFA?: boolean;
    resourceGroups?: {
      sub: string;
      name: string;
      role: "admin" | "write" | "contributor" | "read";
    }[];
  } | undefined;
}
interface HuggingFaceOptions extends ProviderOptions<HuggingFaceProfile> {
  clientId: string;
}
declare const huggingface: (options: HuggingFaceOptions) => {
  id: "huggingface";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: HuggingFaceOptions;
};
//#endregion
//#region src/social-providers/slack.d.ts
interface SlackProfile extends Record<string, any> {
  ok: boolean;
  sub: string;
  "https://slack.com/user_id": string;
  "https://slack.com/team_id": string;
  email: string;
  email_verified: boolean;
  date_email_verified: number;
  name: string;
  picture: string;
  given_name: string;
  family_name: string;
  locale: string;
  "https://slack.com/team_name": string;
  "https://slack.com/team_domain": string;
  "https://slack.com/user_image_24": string;
  "https://slack.com/user_image_32": string;
  "https://slack.com/user_image_48": string;
  "https://slack.com/user_image_72": string;
  "https://slack.com/user_image_192": string;
  "https://slack.com/user_image_512": string;
  "https://slack.com/team_image_34": string;
  "https://slack.com/team_image_44": string;
  "https://slack.com/team_image_68": string;
  "https://slack.com/team_image_88": string;
  "https://slack.com/team_image_102": string;
  "https://slack.com/team_image_132": string;
  "https://slack.com/team_image_230": string;
  "https://slack.com/team_image_default": boolean;
}
interface SlackOptions extends ProviderOptions<SlackProfile> {
  clientId: string;
}
declare const slack: (options: SlackOptions) => {
  id: "slack";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): URL;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: SlackOptions;
};
//#endregion
//#region src/social-providers/spotify.d.ts
interface SpotifyProfile {
  id: string;
  display_name: string;
  email: string;
  images: {
    url: string;
  }[];
}
interface SpotifyOptions extends ProviderOptions<SpotifyProfile> {
  clientId: string;
}
declare const spotify: (options: SpotifyOptions) => {
  id: "spotify";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: SpotifyOptions;
};
//#endregion
//#region src/social-providers/twitch.d.ts
/**
 * @see https://dev.twitch.tv/docs/authentication/getting-tokens-oidc/#requesting-claims
 */
interface TwitchProfile {
  /**
   * The sub of the user
   */
  sub: string;
  /**
   * The preferred username of the user
   */
  preferred_username: string;
  /**
   * The email of the user
   */
  email: string;
  /**
   * Indicate if this user has a verified email.
   */
  email_verified: boolean;
  /**
   * The picture of the user
   */
  picture: string;
}
interface TwitchOptions extends ProviderOptions<TwitchProfile> {
  clientId: string;
  claims?: string[] | undefined;
}
declare const twitch: (options: TwitchOptions) => {
  id: "twitch";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: TwitchOptions;
};
//#endregion
//#region src/social-providers/twitter.d.ts
interface TwitterProfile {
  data: {
    /**
     * Unique identifier of this user. This is returned as a string in order to avoid complications with languages and tools
     * that cannot handle large integers.
     */
    id: string;
    /** The friendly name of this user, as shown on their profile. */
    name: string;
    /** The email address of this user. */
    email?: string | undefined;
    /** The Twitter handle (screen name) of this user. */
    username: string;
    /**
     * The location specified in the user's profile, if the user provided one.
     * As this is a freeform value, it may not indicate a valid location, but it may be fuzzily evaluated when performing searches with location queries.
     *
     * To return this field, add `user.fields=location` in the authorization request's query parameter.
     */
    location?: string | undefined;
    /**
     * This object and its children fields contain details about text that has a special meaning in the user's description.
     *
     *To return this field, add `user.fields=entities` in the authorization request's query parameter.
     */
    entities?: {
      /** Contains details about the user's profile website. */
      url: {
        /** Contains details about the user's profile website. */
        urls: Array<{
          /** The start position (zero-based) of the recognized user's profile website. All start indices are inclusive. */
          start: number;
          /** The end position (zero-based) of the recognized user's profile website. This end index is exclusive. */
          end: number;
          /** The URL in the format entered by the user. */
          url: string;
          /** The fully resolved URL. */
          expanded_url: string;
          /** The URL as displayed in the user's profile. */
          display_url: string;
        }>;
      };
      /** Contains details about URLs, Hashtags, Cashtags, or mentions located within a user's description. */
      description: {
        hashtags: Array<{
          start: number;
          end: number;
          tag: string;
        }>;
      };
    } | undefined;
    /**
     * Indicate if this user is a verified Twitter user.
     *
     * To return this field, add `user.fields=verified` in the authorization request's query parameter.
     */
    verified?: boolean | undefined;
    /**
     * The text of this user's profile description (also known as bio), if the user provided one.
     *
     * To return this field, add `user.fields=description` in the authorization request's query parameter.
     */
    description?: string | undefined;
    /**
     * The URL specified in the user's profile, if present.
     *
     * To return this field, add `user.fields=url` in the authorization request's query parameter.
     */
    url?: string | undefined;
    /** The URL to the profile image for this user, as shown on the user's profile. */
    profile_image_url?: string | undefined;
    protected?: boolean | undefined;
    /**
     * Unique identifier of this user's pinned Tweet.
     *
     *  You can obtain the expanded object in `includes.tweets` by adding `expansions=pinned_tweet_id` in the authorization request's query parameter.
     */
    pinned_tweet_id?: string | undefined;
    created_at?: string | undefined;
  };
  includes?: {
    tweets?: Array<{
      id: string;
      text: string;
    }>;
  } | undefined;
  [claims: string]: unknown;
}
interface TwitterOption extends ProviderOptions<TwitterProfile> {
  clientId: string;
}
declare const twitter: (options: TwitterOption) => {
  id: "twitter";
  name: string;
  createAuthorizationURL(data: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: TwitterOption;
};
//#endregion
//#region src/social-providers/dropbox.d.ts
interface DropboxProfile {
  account_id: string;
  name: {
    given_name: string;
    surname: string;
    familiar_name: string;
    display_name: string;
    abbreviated_name: string;
  };
  email: string;
  email_verified: boolean;
  profile_photo_url: string;
}
interface DropboxOptions extends ProviderOptions<DropboxProfile> {
  clientId: string;
  accessType?: ("offline" | "online" | "legacy") | undefined;
}
declare const dropbox: (options: DropboxOptions) => {
  id: "dropbox";
  name: string;
  createAuthorizationURL: ({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }) => Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: DropboxOptions;
};
//#endregion
//#region src/social-providers/kick.d.ts
interface KickProfile {
  /**
   * The user id of the user
   */
  user_id: string;
  /**
   * The name of the user
   */
  name: string;
  /**
   * The email of the user
   */
  email: string;
  /**
   * The picture of the user
   */
  profile_picture: string;
}
interface KickOptions extends ProviderOptions<KickProfile> {
  clientId: string;
}
declare const kick: (options: KickOptions) => {
  id: "kick";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI,
    codeVerifier
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode({
    code,
    redirectURI,
    codeVerifier
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }): Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: KickOptions;
};
//#endregion
//#region src/social-providers/linear.d.ts
interface LinearUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | undefined;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
interface LinearProfile {
  data: {
    viewer: LinearUser;
  };
}
interface LinearOptions extends ProviderOptions<LinearUser> {
  clientId: string;
}
declare const linear: (options: LinearOptions) => {
  id: "linear";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    loginHint,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: LinearOptions;
};
//#endregion
//#region src/social-providers/linkedin.d.ts
interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale: {
    country: string;
    language: string;
  };
  email: string;
  email_verified: boolean;
}
interface LinkedInOptions extends ProviderOptions<LinkedInProfile> {
  clientId: string;
}
declare const linkedin: (options: LinkedInOptions) => {
  id: "linkedin";
  name: string;
  createAuthorizationURL: ({
    state,
    scopes,
    redirectURI,
    loginHint
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }) => Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: LinkedInOptions;
};
//#endregion
//#region src/social-providers/gitlab.d.ts
interface GitlabProfile extends Record<string, any> {
  id: number;
  username: string;
  email: string;
  name: string;
  state: string;
  avatar_url: string;
  web_url: string;
  created_at: string;
  bio: string;
  location?: string | undefined;
  public_email: string;
  skype: string;
  linkedin: string;
  twitter: string;
  website_url: string;
  organization: string;
  job_title: string;
  pronouns: string;
  bot: boolean;
  work_information?: string | undefined;
  followers: number;
  following: number;
  local_time: string;
  last_sign_in_at: string;
  confirmed_at: string;
  theme_id: number;
  last_activity_on: string;
  color_scheme_id: number;
  projects_limit: number;
  current_sign_in_at: string;
  identities: Array<{
    provider: string;
    extern_uid: string;
  }>;
  can_create_group: boolean;
  can_create_project: boolean;
  two_factor_enabled: boolean;
  external: boolean;
  private_profile: boolean;
  commit_email: string;
  shared_runners_minutes_limit: number;
  extra_shared_runners_minutes_limit: number;
  email_verified?: boolean | undefined;
}
interface GitlabOptions extends ProviderOptions<GitlabProfile> {
  clientId: string;
  issuer?: string | undefined;
}
declare const gitlab: (options: GitlabOptions) => {
  id: "gitlab";
  name: string;
  createAuthorizationURL: ({
    state,
    scopes,
    codeVerifier,
    loginHint,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }) => Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI,
    codeVerifier
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | {
    user: {
      id: number;
      name: string;
      email: string;
      image: string;
      emailVerified: boolean;
    } | {
      id: string | number;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    } | {
      id: string | number;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    };
    data: GitlabProfile;
  } | null>;
  options: GitlabOptions;
};
//#endregion
//#region src/social-providers/tiktok.d.ts
/**
 * [More info](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info/)
 */
interface TiktokProfile extends Record<string, any> {
  data: {
    user: {
      /**
       * The unique identification of the user in the current application.Open id
       * for the client.
       *
       * To return this field, add `fields=open_id` in the user profile request's query parameter.
       */
      open_id: string;
      /**
       * The unique identification of the user across different apps for the same developer.
       * For example, if a partner has X number of clients,
       * it will get X number of open_id for the same TikTok user,
       * but one persistent union_id for the particular user.
       *
       * To return this field, add `fields=union_id` in the user profile request's query parameter.
       */
      union_id?: string | undefined;
      /**
       * User's profile image.
       *
       * To return this field, add `fields=avatar_url` in the user profile request's query parameter.
       */
      avatar_url?: string | undefined;
      /**
       * User`s profile image in 100x100 size.
       *
       * To return this field, add `fields=avatar_url_100` in the user profile request's query parameter.
       */
      avatar_url_100?: string | undefined;
      /**
       * User's profile image with higher resolution
       *
       * To return this field, add `fields=avatar_url_100` in the user profile request's query parameter.
       */
      avatar_large_url: string;
      /**
       * User's profile name
       *
       * To return this field, add `fields=display_name` in the user profile request's query parameter.
       */
      display_name: string;
      /**
       * User's username.
       *
       * To return this field, add `fields=username` in the user profile request's query parameter.
       */
      username: string;
      /** @note Email is currently unsupported by TikTok  */
      email?: string | undefined;
      /**
       * User's bio description if there is a valid one.
       *
       * To return this field, add `fields=bio_description` in the user profile request's query parameter.
       */
      bio_description?: string | undefined;
      /**
       * The link to user's TikTok profile page.
       *
       * To return this field, add `fields=profile_deep_link` in the user profile request's query parameter.
       */
      profile_deep_link?: string | undefined;
      /**
       * Whether TikTok has provided a verified badge to the account after confirming
       * that it belongs to the user it represents.
       *
       * To return this field, add `fields=is_verified` in the user profile request's query parameter.
       */
      is_verified?: boolean | undefined;
      /**
       * User's followers count.
       *
       * To return this field, add `fields=follower_count` in the user profile request's query parameter.
       */
      follower_count?: number | undefined;
      /**
       * The number of accounts that the user is following.
       *
       * To return this field, add `fields=following_count` in the user profile request's query parameter.
       */
      following_count?: number | undefined;
      /**
       * The total number of likes received by the user across all of their videos.
       *
       * To return this field, add `fields=likes_count` in the user profile request's query parameter.
       */
      likes_count?: number | undefined;
      /**
       * The total number of publicly posted videos by the user.
       *
       * To return this field, add `fields=video_count` in the user profile request's query parameter.
       */
      video_count?: number | undefined;
    };
  };
  error?: {
    /**
     * The error category in string.
     */
    code?: string;
    /**
     * The error message in string.
     */
    message?: string;
    /**
     * The error message in string.
     */
    log_id?: string;
  } | undefined;
}
interface TiktokOptions extends ProviderOptions {
  clientId?: never | undefined;
  clientSecret: string;
  clientKey: string;
}
declare const tiktok: (options: TiktokOptions) => {
  id: "tiktok";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): URL;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: TiktokOptions;
};
//#endregion
//#region src/social-providers/reddit.d.ts
interface RedditProfile {
  id: string;
  name: string;
  icon_img: string | null;
  has_verified_email: boolean;
  oauth_client_id: string;
  verified: boolean;
}
interface RedditOptions extends ProviderOptions<RedditProfile> {
  clientId: string;
  duration?: string | undefined;
}
declare const reddit: (options: RedditOptions) => {
  id: "reddit";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: RedditOptions;
};
//#endregion
//#region src/social-providers/roblox.d.ts
interface RobloxProfile extends Record<string, any> {
  /** the user's id */
  sub: string;
  /** the user's username */
  preferred_username: string;
  /** the user's display name, will return the same value as the preferred_username if not set */
  nickname: string;
  /** the user's display name, again, will return the same value as the preferred_username if not set */
  name: string;
  /** the account creation date as a unix timestamp in seconds */
  created_at: number;
  /** the user's profile URL */
  profile: string;
  /** the user's avatar URL */
  picture: string;
}
interface RobloxOptions extends ProviderOptions<RobloxProfile> {
  clientId: string;
  prompt?: ("none" | "consent" | "login" | "select_account" | "select_account consent") | undefined;
}
declare const roblox: (options: RobloxOptions) => {
  id: "roblox";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): URL;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: RobloxOptions;
};
//#endregion
//#region src/social-providers/salesforce.d.ts
interface SalesforceProfile {
  sub: string;
  user_id: string;
  organization_id: string;
  preferred_username?: string | undefined;
  email: string;
  email_verified?: boolean | undefined;
  name: string;
  given_name?: string | undefined;
  family_name?: string | undefined;
  zoneinfo?: string | undefined;
  photos?: {
    picture?: string;
    thumbnail?: string;
  } | undefined;
}
interface SalesforceOptions extends ProviderOptions<SalesforceProfile> {
  clientId: string;
  environment?: ("sandbox" | "production") | undefined;
  loginUrl?: string | undefined;
  /**
   * Override the redirect URI if auto-detection fails.
   * Should match the Callback URL configured in your Salesforce Connected App.
   * @example "http://localhost:3000/api/auth/callback/salesforce"
   */
  redirectURI?: string | undefined;
}
declare const salesforce: (options: SalesforceOptions) => {
  id: "salesforce";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: SalesforceOptions;
};
//#endregion
//#region src/social-providers/vk.d.ts
interface VkProfile {
  user: {
    user_id: string;
    first_name: string;
    last_name: string;
    email?: string | undefined;
    phone?: number | undefined;
    avatar?: string | undefined;
    sex?: number | undefined;
    verified?: boolean | undefined;
    birthday: string;
  };
}
interface VkOption extends ProviderOptions {
  clientId: string;
  scheme?: ("light" | "dark") | undefined;
}
declare const vk: (options: VkOption) => {
  id: "vk";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI,
    deviceId
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(data: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: VkOption;
};
//#endregion
//#region src/social-providers/zoom.d.ts
type LoginType = 0 /** Facebook OAuth */ | 1 /** Google OAuth */ | 24 /** Apple OAuth */ | 27 /** Microsoft OAuth */ | 97 /** Mobile device */ | 98 /** RingCentral OAuth */ | 99 /** API user */ | 100 /** Zoom Work email */ | 101;
/** Single Sign-On (SSO) */
type AccountStatus = "pending" | "active" | "inactive";
type PronounOption = 1 /** Ask the user every time */ | 2 /** Always display */ | 3;
/** Do not display */
interface PhoneNumber {
  /** The country code of the phone number (Example: "+1") */
  code: string;
  /** The country of the phone number (Example: "US") */
  country: string;
  /** The label for the phone number (Example: "Mobile") */
  label: string;
  /** The phone number itself (Example: "800000000") */
  number: string;
  /** Whether the phone number has been verified (Example: true) */
  verified: boolean;
}
/**
 * See the full documentation below:
 * https://developers.zoom.us/docs/api/users/#tag/users/GET/users/{userId}
 */
interface ZoomProfile extends Record<string, any> {
  /** The user's account ID (Example: "q6gBJVO5TzexKYTb_I2rpg") */
  account_id: string;
  /** The user's account number (Example: 10009239) */
  account_number: number;
  /** The user's cluster (Example: "us04") */
  cluster: string;
  /** The user's CMS ID. Only enabled for Kaltura integration (Example: "KDcuGIm1QgePTO8WbOqwIQ") */
  cms_user_id: string;
  /** The user's cost center (Example: "cost center") */
  cost_center: string;
  /** User create time (Example: "2018-10-31T04:32:37Z") */
  created_at: string;
  /** Department (Example: "Developers") */
  dept: string;
  /** User's display name (Example: "Jill Chill") */
  display_name: string;
  /** User's email address (Example: "jchill@example.com") */
  email: string;
  /** User's first name (Example: "Jill") */
  first_name: string;
  /** IDs of the web groups that the user belongs to (Example: ["RSMaSp8sTEGK0_oamiA2_w"]) */
  group_ids: string[];
  /** User ID (Example: "zJKyaiAyTNC-MWjiWC18KQ") */
  id: string;
  /** IM IDs of the groups that the user belongs to (Example: ["t-_-d56CSWG-7BF15LLrOw"]) */
  im_group_ids: string[];
  /** The user's JID (Example: "jchill@example.com") */
  jid: string;
  /** The user's job title (Example: "API Developer") */
  job_title: string;
  /** Default language for the Zoom Web Portal (Example: "en-US") */
  language: string;
  /** User last login client version (Example: "5.9.6.4993(mac)") */
  last_client_version: string;
  /** User last login time (Example: "2021-05-05T20:40:30Z") */
  last_login_time: string;
  /** User's last name (Example: "Chill") */
  last_name: string;
  /** The time zone of the user (Example: "Asia/Shanghai") */
  timezone: string;
  /** User's location (Example: "Paris") */
  location: string;
  /** The user's login method (Example: 101) */
  login_types: LoginType[];
  /** User's personal meeting URL (Example: "example.com") */
  personal_meeting_url: string;
  /** This field has been deprecated and will not be supported in the future.
   * Use the phone_numbers field instead of this field.
   * The user's phone number (Example: "+1 800000000") */
  phone_number?: string | undefined;
  /** The URL for user's profile picture (Example: "example.com") */
  pic_url: string;
  /** Personal Meeting ID (PMI) (Example: 3542471135) */
  pmi: number;
  /** Unique identifier of the user's assigned role (Example: "0") */
  role_id: string;
  /** User's role name (Example: "Admin") */
  role_name: string;
  /** Status of user's account (Example: "pending") */
  status: AccountStatus;
  /** Use the personal meeting ID (PMI) for instant meetings (Example: false) */
  use_pmi: boolean;
  /** The time and date when the user was created (Example: "2018-10-31T04:32:37Z") */
  user_created_at: string;
  /** Displays whether user is verified or not (Example: 1) */
  verified: number;
  /** The user's Zoom Workplace plan option (Example: 64) */
  zoom_one_type: number;
  /** The user's company (Example: "Jill") */
  company?: string | undefined;
  /** Custom attributes that have been assigned to the user (Example: [{ "key": "cbf_cywdkexrtqc73f97gd4w6g", "name": "A1", "value": "1" }]) */
  custom_attributes?: {
    key: string;
    name: string;
    value: string;
  }[] | undefined;
  /** The employee's unique ID. This field only returns when SAML single sign-on (SSO) is enabled.
   * The `login_type` value is `101` (SSO) (Example: "HqDyI037Qjili1kNsSIrIg") */
  employee_unique_id?: string | undefined;
  /** The manager for the user (Example: "thill@example.com") */
  manager?: string | undefined;
  /** The user's country for the company phone number (Example: "US")
   * @deprecated true */
  phone_country?: string | undefined;
  /** The phone number's ISO country code (Example: "+1") */
  phone_numbers?: PhoneNumber[] | undefined;
  /** The user's plan type (Example: "1") */
  plan_united_type?: string | undefined;
  /** The user's pronouns (Example: "3123") */
  pronouns?: string | undefined;
  /** The user's display pronouns setting (Example: 1) */
  pronouns_option?: PronounOption | undefined;
  /** Personal meeting room URL, if the user has one (Example: "example.com") */
  vanity_url?: string | undefined;
}
interface ZoomOptions extends ProviderOptions<ZoomProfile> {
  clientId: string;
  pkce?: boolean | undefined;
}
declare const zoom: (userOptions: ZoomOptions) => {
  id: "zoom";
  name: string;
  createAuthorizationURL: ({
    state,
    redirectURI,
    codeVerifier
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }) => Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI,
    codeVerifier
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
};
//#endregion
//#region src/social-providers/notion.d.ts
interface NotionProfile {
  object: "user";
  id: string;
  type: "person" | "bot";
  name?: string | undefined;
  avatar_url?: string | undefined;
  person?: {
    email?: string;
  } | undefined;
}
interface NotionOptions extends ProviderOptions<NotionProfile> {
  clientId: string;
}
declare const notion: (options: NotionOptions) => {
  id: "notion";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    loginHint,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: NotionOptions;
};
//#endregion
//#region src/social-providers/kakao.d.ts
interface Partner {
  /** Partner-specific ID (consent required: kakaotalk_message) */
  uuid?: string | undefined;
}
interface Profile {
  /** Nickname (consent required: profile/nickname) */
  nickname?: string | undefined;
  /** Thumbnail image URL (consent required: profile/profile image) */
  thumbnail_image_url?: string | undefined;
  /** Profile image URL (consent required: profile/profile image) */
  profile_image_url?: string | undefined;
  /** Whether the profile image is the default */
  is_default_image?: boolean | undefined;
  /** Whether the nickname is the default */
  is_default_nickname?: boolean | undefined;
}
interface KakaoAccount {
  /** Consent required: profile info (nickname/profile image) */
  profile_needs_agreement?: boolean | undefined;
  /** Consent required: nickname */
  profile_nickname_needs_agreement?: boolean | undefined;
  /** Consent required: profile image */
  profile_image_needs_agreement?: boolean | undefined;
  /** Profile info */
  profile?: Profile | undefined;
  /** Consent required: name */
  name_needs_agreement?: boolean | undefined;
  /** Name */
  name?: string | undefined;
  /** Consent required: email */
  email_needs_agreement?: boolean | undefined;
  /** Email valid */
  is_email_valid?: boolean | undefined;
  /** Email verified */
  is_email_verified?: boolean | undefined;
  /** Email */
  email?: string | undefined;
  /** Consent required: age range */
  age_range_needs_agreement?: boolean | undefined;
  /** Age range */
  age_range?: string | undefined;
  /** Consent required: birth year */
  birthyear_needs_agreement?: boolean | undefined;
  /** Birth year (YYYY) */
  birthyear?: string | undefined;
  /** Consent required: birthday */
  birthday_needs_agreement?: boolean | undefined;
  /** Birthday (MMDD) */
  birthday?: string | undefined;
  /** Birthday type (SOLAR/LUNAR) */
  birthday_type?: string | undefined;
  /** Whether birthday is in a leap month */
  is_leap_month?: boolean | undefined;
  /** Consent required: gender */
  gender_needs_agreement?: boolean | undefined;
  /** Gender (male/female) */
  gender?: string | undefined;
  /** Consent required: phone number */
  phone_number_needs_agreement?: boolean | undefined;
  /** Phone number */
  phone_number?: string | undefined;
  /** Consent required: CI */
  ci_needs_agreement?: boolean | undefined;
  /** CI (unique identifier) */
  ci?: string | undefined;
  /** CI authentication time (UTC) */
  ci_authenticated_at?: string | undefined;
}
interface KakaoProfile {
  /** Kakao user ID */
  id: number;
  /**
   * Whether the user has signed up (only present if auto-connection is disabled)
   * false: preregistered, true: registered
   */
  has_signed_up?: boolean | undefined;
  /** UTC datetime when the user connected the service */
  connected_at?: string | undefined;
  /** UTC datetime when the user signed up via Kakao Sync */
  synched_at?: string | undefined;
  /** Custom user properties */
  properties?: Record<string, any> | undefined;
  /** Kakao account info */
  kakao_account: KakaoAccount;
  /** Partner info */
  for_partner?: Partner | undefined;
}
interface KakaoOptions extends ProviderOptions<KakaoProfile> {
  clientId: string;
}
declare const kakao: (options: KakaoOptions) => {
  id: "kakao";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | {
    user: {
      id: string;
      name: string | undefined;
      email: string | undefined;
      image: string | undefined;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    };
    data: KakaoProfile;
  } | null>;
  options: KakaoOptions;
};
//#endregion
//#region src/social-providers/naver.d.ts
interface NaverProfile {
  /** API response result code */
  resultcode: string;
  /** API response message */
  message: string;
  response: {
    /** Unique Naver user identifier */
    id: string;
    /** User nickname */
    nickname: string;
    /** User real name */
    name: string;
    /** User email address */
    email: string;
    /** Gender (F: female, M: male, U: unknown) */
    gender: string;
    /** Age range */
    age: string;
    /** Birthday (MM-DD format) */
    birthday: string;
    /** Birth year */
    birthyear: string;
    /** Profile image URL */
    profile_image: string;
    /** Mobile phone number */
    mobile: string;
  };
}
interface NaverOptions extends ProviderOptions<NaverProfile> {
  clientId: string;
}
declare const naver: (options: NaverOptions) => {
  id: "naver";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | {
    user: {
      id: string;
      name: string;
      email: string;
      image: string;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    };
    data: NaverProfile;
  } | null>;
  options: NaverOptions;
};
//#endregion
//#region src/social-providers/line.d.ts
interface LineIdTokenPayload {
  iss: string;
  sub: string;
  aud: string;
  exp: number;
  iat: number;
  name?: string | undefined;
  picture?: string | undefined;
  email?: string | undefined;
  amr?: string[] | undefined;
  nonce?: string | undefined;
}
interface LineUserInfo {
  sub: string;
  name?: string | undefined;
  picture?: string | undefined;
  email?: string | undefined;
}
interface LineOptions extends ProviderOptions<LineUserInfo | LineIdTokenPayload> {
  clientId: string;
}
/**
 * LINE Login v2.1
 * - Authorization endpoint: https://access.line.me/oauth2/v2.1/authorize
 * - Token endpoint: https://api.line.me/oauth2/v2.1/token
 * - UserInfo endpoint: https://api.line.me/oauth2/v2.1/userinfo
 * - Verify ID token: https://api.line.me/oauth2/v2.1/verify
 *
 * Docs: https://developers.line.biz/en/reference/line-login/#issue-access-token
 */
declare const line: (options: LineOptions) => {
  id: "line";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI,
    loginHint
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | {
    user: {
      id: any;
      name: any;
      email: any;
      image: any;
      emailVerified: false;
    } | {
      id: any;
      name: any;
      email: any;
      image: any;
      emailVerified: boolean;
    } | {
      id: any;
      name: any;
      email: any;
      image: any;
      emailVerified: boolean;
    };
    data: any;
  } | null>;
  options: LineOptions;
};
//#endregion
//#region src/social-providers/paybin.d.ts
interface PaybinProfile {
  sub: string;
  email: string;
  email_verified?: boolean | undefined;
  name?: string | undefined;
  preferred_username?: string | undefined;
  picture?: string | undefined;
  given_name?: string | undefined;
  family_name?: string | undefined;
}
interface PaybinOptions extends ProviderOptions<PaybinProfile> {
  clientId: string;
  /**
   * The issuer URL of your Paybin OAuth server
   * @default "https://idp.paybin.io"
   */
  issuer?: string | undefined;
}
declare const paybin: (options: PaybinOptions) => {
  id: "paybin";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI,
    loginHint
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: PaybinOptions;
};
//#endregion
//#region src/social-providers/paypal.d.ts
interface PayPalProfile {
  user_id: string;
  name: string;
  given_name: string;
  family_name: string;
  middle_name?: string | undefined;
  picture?: string | undefined;
  email: string;
  email_verified: boolean;
  gender?: string | undefined;
  birthdate?: string | undefined;
  zoneinfo?: string | undefined;
  locale?: string | undefined;
  phone_number?: string | undefined;
  address?: {
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  } | undefined;
  verified_account?: boolean | undefined;
  account_type?: string | undefined;
  age_range?: string | undefined;
  payer_id?: string | undefined;
}
interface PayPalTokenResponse {
  scope?: string | undefined;
  access_token: string;
  refresh_token?: string | undefined;
  token_type: "Bearer";
  id_token?: string | undefined;
  expires_in: number;
  nonce?: string | undefined;
}
interface PayPalOptions extends ProviderOptions<PayPalProfile> {
  clientId: string;
  /**
   * PayPal environment - 'sandbox' for testing, 'live' for production
   * @default 'sandbox'
   */
  environment?: ("sandbox" | "live") | undefined;
  /**
   * Whether to request shipping address information
   * @default false
   */
  requestShippingAddress?: boolean | undefined;
}
declare const paypal: (options: PayPalOptions) => {
  id: "paypal";
  name: string;
  createAuthorizationURL({
    state,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<{
    accessToken: string;
    refreshToken: string | undefined;
    accessTokenExpiresAt: Date | undefined;
    idToken: string | undefined;
  }>;
  refreshAccessToken: ((refreshToken: string) => Promise<OAuth2Tokens>) | ((refreshToken: string) => Promise<{
    accessToken: any;
    refreshToken: any;
    accessTokenExpiresAt: Date | undefined;
  }>);
  verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName
        /**
         * Whether to request shipping address information
         * @default false
         */?
        /**
        * Whether to request shipping address information
        * @default false
        */
        : string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | {
    user: {
      id: string;
      name: string;
      email: string;
      image: string | undefined;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    } | {
      id: string;
      name: string;
      email: string | null;
      image: string;
      emailVerified: boolean;
    };
    data: PayPalProfile;
  } | null>;
  options: PayPalOptions;
};
//#endregion
//#region src/social-providers/polar.d.ts
interface PolarProfile {
  id: string;
  email: string;
  username: string;
  avatar_url: string;
  github_username?: string | undefined;
  account_id?: string | undefined;
  public_name?: string | undefined;
  email_verified?: boolean | undefined;
  profile_settings?: {
    profile_settings_enabled?: boolean;
    profile_settings_public_name?: string;
    profile_settings_public_avatar?: string;
    profile_settings_public_bio?: string;
    profile_settings_public_location?: string;
    profile_settings_public_website?: string;
    profile_settings_public_twitter?: string;
    profile_settings_public_github?: string;
    profile_settings_public_email?: string;
  } | undefined;
}
interface PolarOptions extends ProviderOptions<PolarProfile> {}
declare const polar: (options: PolarOptions) => {
  id: "polar";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: PolarOptions;
};
//#endregion
//#region src/social-providers/vercel.d.ts
interface VercelProfile {
  sub: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  email_verified?: boolean;
  picture?: string;
}
interface VercelOptions extends ProviderOptions<VercelProfile> {
  clientId: string;
}
declare const vercel: (options: VercelOptions) => {
  id: "vercel";
  name: string;
  createAuthorizationURL({
    state,
    scopes,
    codeVerifier,
    redirectURI
  }: {
    state: string;
    codeVerifier: string;
    scopes?: string[] | undefined;
    redirectURI: string;
    display?: string | undefined;
    loginHint?: string | undefined;
  }): Promise<URL>;
  validateAuthorizationCode: ({
    code,
    codeVerifier,
    redirectURI
  }: {
    code: string;
    redirectURI: string;
    codeVerifier?: string | undefined;
    deviceId?: string | undefined;
  }) => Promise<OAuth2Tokens>;
  getUserInfo(token: OAuth2Tokens & {
    user?: {
      name?: {
        firstName?: string;
        lastName?: string;
      };
      email?: string;
    } | undefined;
  }): Promise<{
    user: {
      id: string;
      name?: string;
      email?: string | null;
      image?: string;
      emailVerified: boolean;
      [key: string]: any;
    };
    data: any;
  } | null>;
  options: VercelOptions;
};
//#endregion
//#region src/social-providers/index.d.ts
declare const socialProviders: {
  apple: (options: AppleOptions) => {
    id: "apple";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: AppleOptions;
  };
  atlassian: (options: AtlassianOptions) => {
    id: "atlassian";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: AtlassianOptions;
  };
  cognito: (options: CognitoOptions) => {
    id: "cognito";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: CognitoOptions;
  };
  discord: (options: DiscordOptions) => {
    id: "discord";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): URL;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: DiscordOptions;
  };
  facebook: (options: FacebookOptions) => {
    id: "facebook";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI,
      loginHint
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: FacebookOptions;
  };
  figma: (options: FigmaOptions) => {
    id: "figma";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: FigmaOptions;
  };
  github: (options: GithubOptions) => {
    id: "github";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      loginHint,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: GithubOptions;
  };
  microsoft: (options: MicrosoftOptions) => {
    id: "microsoft";
    name: string;
    createAuthorizationURL(data: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }): Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    options: MicrosoftOptions;
  };
  google: (options: GoogleOptions) => {
    id: "google";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI,
      loginHint,
      display
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: GoogleOptions;
  };
  huggingface: (options: HuggingFaceOptions) => {
    id: "huggingface";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: HuggingFaceOptions;
  };
  slack: (options: SlackOptions) => {
    id: "slack";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): URL;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: SlackOptions;
  };
  spotify: (options: SpotifyOptions) => {
    id: "spotify";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: SpotifyOptions;
  };
  twitch: (options: TwitchOptions) => {
    id: "twitch";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: TwitchOptions;
  };
  twitter: (options: TwitterOption) => {
    id: "twitter";
    name: string;
    createAuthorizationURL(data: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: TwitterOption;
  };
  dropbox: (options: DropboxOptions) => {
    id: "dropbox";
    name: string;
    createAuthorizationURL: ({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }) => Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: DropboxOptions;
  };
  kick: (options: KickOptions) => {
    id: "kick";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI,
      codeVerifier
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode({
      code,
      redirectURI,
      codeVerifier
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }): Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: KickOptions;
  };
  linear: (options: LinearOptions) => {
    id: "linear";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      loginHint,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: LinearOptions;
  };
  linkedin: (options: LinkedInOptions) => {
    id: "linkedin";
    name: string;
    createAuthorizationURL: ({
      state,
      scopes,
      redirectURI,
      loginHint
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }) => Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: LinkedInOptions;
  };
  gitlab: (options: GitlabOptions) => {
    id: "gitlab";
    name: string;
    createAuthorizationURL: ({
      state,
      scopes,
      codeVerifier,
      loginHint,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }) => Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI,
      codeVerifier
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | {
      user: {
        id: number;
        name: string;
        email: string;
        image: string;
        emailVerified: boolean;
      } | {
        id: string | number;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      } | {
        id: string | number;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      };
      data: GitlabProfile;
    } | null>;
    options: GitlabOptions;
  };
  tiktok: (options: TiktokOptions) => {
    id: "tiktok";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): URL;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: TiktokOptions;
  };
  reddit: (options: RedditOptions) => {
    id: "reddit";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: RedditOptions;
  };
  roblox: (options: RobloxOptions) => {
    id: "roblox";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): URL;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: RobloxOptions;
  };
  salesforce: (options: SalesforceOptions) => {
    id: "salesforce";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: SalesforceOptions;
  };
  vk: (options: VkOption) => {
    id: "vk";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI,
      deviceId
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(data: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: VkOption;
  };
  zoom: (userOptions: ZoomOptions) => {
    id: "zoom";
    name: string;
    createAuthorizationURL: ({
      state,
      redirectURI,
      codeVerifier
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }) => Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI,
      codeVerifier
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
  };
  notion: (options: NotionOptions) => {
    id: "notion";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      loginHint,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: NotionOptions;
  };
  kakao: (options: KakaoOptions) => {
    id: "kakao";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | {
      user: {
        id: string;
        name: string | undefined;
        email: string | undefined;
        image: string | undefined;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      };
      data: KakaoProfile;
    } | null>;
    options: KakaoOptions;
  };
  naver: (options: NaverOptions) => {
    id: "naver";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | {
      user: {
        id: string;
        name: string;
        email: string;
        image: string;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      };
      data: NaverProfile;
    } | null>;
    options: NaverOptions;
  };
  line: (options: LineOptions) => {
    id: "line";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI,
      loginHint
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | {
      user: {
        id: any;
        name: any;
        email: any;
        image: any;
        emailVerified: false;
      } | {
        id: any;
        name: any;
        email: any;
        image: any;
        emailVerified: boolean;
      } | {
        id: any;
        name: any;
        email: any;
        image: any;
        emailVerified: boolean;
      };
      data: any;
    } | null>;
    options: LineOptions;
  };
  paybin: (options: PaybinOptions) => {
    id: "paybin";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI,
      loginHint
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: PaybinOptions;
  };
  paypal: (options: PayPalOptions) => {
    id: "paypal";
    name: string;
    createAuthorizationURL({
      state,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<{
      accessToken: string;
      refreshToken: string | undefined;
      accessTokenExpiresAt: Date | undefined;
      idToken: string | undefined;
    }>;
    refreshAccessToken: ((refreshToken: string) => Promise<OAuth2Tokens>) | ((refreshToken: string) => Promise<{
      accessToken: any;
      refreshToken: any;
      accessTokenExpiresAt: Date | undefined;
    }>);
    verifyIdToken(token: string, nonce: string | undefined): Promise<boolean>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | {
      user: {
        id: string;
        name: string;
        email: string;
        image: string | undefined;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      } | {
        id: string;
        name: string;
        email: string | null;
        image: string;
        emailVerified: boolean;
      };
      data: PayPalProfile;
    } | null>;
    options: PayPalOptions;
  };
  polar: (options: PolarOptions) => {
    id: "polar";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    refreshAccessToken: (refreshToken: string) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: PolarOptions;
  };
  vercel: (options: VercelOptions) => {
    id: "vercel";
    name: string;
    createAuthorizationURL({
      state,
      scopes,
      codeVerifier,
      redirectURI
    }: {
      state: string;
      codeVerifier: string;
      scopes?: string[] | undefined;
      redirectURI: string;
      display?: string | undefined;
      loginHint?: string | undefined;
    }): Promise<URL>;
    validateAuthorizationCode: ({
      code,
      codeVerifier,
      redirectURI
    }: {
      code: string;
      redirectURI: string;
      codeVerifier?: string | undefined;
      deviceId?: string | undefined;
    }) => Promise<OAuth2Tokens>;
    getUserInfo(token: OAuth2Tokens & {
      user?: {
        name?: {
          firstName?: string;
          lastName?: string;
        };
        email?: string;
      } | undefined;
    }): Promise<{
      user: {
        id: string;
        name?: string;
        email?: string | null;
        image?: string;
        emailVerified: boolean;
        [key: string]: any;
      };
      data: any;
    } | null>;
    options: VercelOptions;
  };
};
declare const socialProviderList: ["github", ...(keyof typeof socialProviders)[]];
declare const SocialProviderListEnum: z.ZodType<SocialProviderList[number] | (string & {})>;
type SocialProvider = z.infer<typeof SocialProviderListEnum>;
type SocialProviders = { [K in SocialProviderList[number]]?: Parameters<(typeof socialProviders)[K]>[0] & {
  enabled?: boolean | undefined;
} };
type SocialProviderList = typeof socialProviderList;
//#endregion
//#region src/types/plugin.d.ts
type Awaitable<T> = T | Promise<T>;
type DeepPartial<T> = T extends Function ? T : T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T;
type HookEndpointContext = Partial<EndpointContext<string, any> & Omit<InputContext<string, any>, "method">> & {
  path: string;
  context: AuthContext & {
    returned?: unknown | undefined;
    responseHeaders?: Headers | undefined;
  };
  headers?: Headers | undefined;
};
type BetterAuthPlugin = {
  id: LiteralString;
  /**
   * The init function is called when the plugin is initialized.
   * You can return a new context or modify the existing context.
   */
  init?: ((ctx: AuthContext) => Awaitable<{
    context?: DeepPartial<Omit<AuthContext, "options">>;
    options?: Partial<BetterAuthOptions>;
  }> | void | Promise<void>) | undefined;
  endpoints?: {
    [key: string]: Endpoint;
  } | undefined;
  middlewares?: {
    path: string;
    middleware: Middleware;
  }[] | undefined;
  onRequest?: ((request: Request, ctx: AuthContext) => Promise<{
    response: Response;
  } | {
    request: Request;
  } | void>) | undefined;
  onResponse?: ((response: Response, ctx: AuthContext) => Promise<{
    response: Response;
  } | void>) | undefined;
  hooks?: {
    before?: {
      matcher: (context: HookEndpointContext) => boolean;
      handler: AuthMiddleware;
    }[];
    after?: {
      matcher: (context: HookEndpointContext) => boolean;
      handler: AuthMiddleware;
    }[];
  } | undefined;
  /**
   * Schema the plugin needs
   *
   * This will also be used to migrate the database. If the fields are dynamic from the plugins
   * configuration each time the configuration is changed a new migration will be created.
   *
   * NOTE: If you want to create migrations manually using
   * migrations option or any other way you
   * can disable migration per table basis.
   *
   * @example
   * ```ts
   * schema: {
   * 	user: {
   * 		fields: {
   * 			email: {
   * 				 type: "string",
   * 			},
   * 			emailVerified: {
   * 				type: "boolean",
   * 				defaultValue: false,
   * 			},
   * 		},
   * 	}
   * } as AuthPluginSchema
   * ```
   */
  schema?: BetterAuthPluginDBSchema | undefined;
  /**
   * The migrations of the plugin. If you define schema that will automatically create
   * migrations for you.
   *
   * ⚠️ Only uses this if you dont't want to use the schema option and you disabled migrations for
   * the tables.
   */
  migrations?: Record<string, Migration> | undefined;
  /**
   * The options of the plugin
   */
  options?: Record<string, any> | undefined;
  /**
   * types to be inferred
   */
  $Infer?: Record<string, any> | undefined;
  /**
   * The rate limit rules to apply to specific paths.
   */
  rateLimit?: {
    window: number;
    max: number;
    pathMatcher: (path: string) => boolean;
  }[] | undefined;
  /**
   * The error codes returned by the plugin
   */
  $ERROR_CODES?: Record<string, string> | undefined;
  /**
   * All database operations that are performed by the plugin
   *
   * This will override the default database operations
   */
  adapter?: {
    [key: string]: (...args: any[]) => Promise<any> | any;
  };
};
//#endregion
//#region src/types/init-options.d.ts
type KyselyDatabaseType = "postgres" | "mysql" | "sqlite" | "mssql";
type OmitId<T extends {
  id: unknown;
}> = Omit<T, "id">;
type Optional<T> = { [P in keyof T]?: T[P] | undefined };
type GenerateIdFn = (options: {
  model: LiteralUnion<DBPreservedModels, string>;
  size?: number | undefined;
}) => string | false;
type BetterAuthRateLimitOptions = {
  /**
   * By default, rate limiting is only
   * enabled on production.
   */
  enabled?: boolean | undefined;
  /**
   * Default window to use for rate limiting. The value
   * should be in seconds.
   *
   * @default 10 seconds
   */
  window?: number | undefined;
  /**
   * The default maximum number of requests allowed within the window.
   *
   * @default 100 requests
   */
  max?: number | undefined;
  /**
   * Custom rate limit rules to apply to
   * specific paths.
   */
  customRules?: {
    [key: string]: {
      /**
       * The window to use for the custom rule.
       */
      window: number;
      /**
       * The maximum number of requests allowed within the window.
       */
      max: number;
    } | false | ((request: Request) => {
      window: number;
      max: number;
    } | false | Promise<{
      window: number;
      max: number;
    } | false>);
  } | undefined;
  /**
   * Storage configuration
   *
   * By default, rate limiting is stored in memory. If you passed a
   * secondary storage, rate limiting will be stored in the secondary
   * storage.
   *
   * @default "memory"
   */
  storage?: ("memory" | "database" | "secondary-storage") | undefined;
  /**
   * If database is used as storage, the name of the table to
   * use for rate limiting.
   *
   * @default "rateLimit"
   */
  modelName?: string | undefined;
  /**
   * Custom field names for the rate limit table
   */
  fields?: Record<keyof RateLimit, string> | undefined;
  /**
   * custom storage configuration.
   *
   * NOTE: If custom storage is used storage
   * is ignored
   */
  customStorage?: {
    get: (key: string) => Promise<RateLimit | undefined>;
    set: (key: string, value: RateLimit) => Promise<void>;
  };
};
type BetterAuthAdvancedOptions = {
  /**
   * Ip address configuration
   */
  ipAddress?: {
    /**
     * List of headers to use for ip address
     *
     * Ip address is used for rate limiting and session tracking
     *
     * @example ["x-client-ip", "x-forwarded-for", "cf-connecting-ip"]
     *
     * @default
     * @link https://github.com/better-auth/better-auth/blob/main/packages/better-auth/src/utils/get-request-ip.ts#L8
     */
    ipAddressHeaders?: string[];
    /**
     * Disable ip tracking
     *
     * ⚠︎ This is a security risk and it may expose your application to abuse
     */
    disableIpTracking?: boolean;
  } | undefined;
  /**
   * Use secure cookies
   *
   * @default false
   */
  useSecureCookies?: boolean | undefined;
  /**
   * Disable trusted origins check
   *
   * ⚠︎ This is a security risk and it may expose your application to
   * CSRF attacks
   */
  disableCSRFCheck?: boolean | undefined;
  /**
   * Disable origin check
   *
   * ⚠︎ This may allow requests from any origin to be processed by
   * Better Auth. And could lead to security vulnerabilities.
   */
  disableOriginCheck?: boolean | undefined;
  /**
   * Configure cookies to be cross subdomains
   */
  crossSubDomainCookies?: {
    /**
     * Enable cross subdomain cookies
     */
    enabled: boolean;
    /**
     * Additional cookies to be shared across subdomains
     */
    additionalCookies?: string[];
    /**
     * The domain to use for the cookies
     *
     * By default, the domain will be the root
     * domain from the base URL.
     */
    domain?: string;
  } | undefined;
  cookies?: {
    [key: string]: {
      name?: string;
      attributes?: CookieOptions;
    };
  } | undefined;
  defaultCookieAttributes?: CookieOptions | undefined;
  /**
   * Prefix for cookies. If a cookie name is provided
   * in cookies config, this will be overridden.
   *
   * @default
   * ```txt
   * "appName" -> which defaults to "better-auth"
   * ```
   */
  cookiePrefix?: string | undefined;
  /**
   * Database configuration.
   */
  database?: {
    /**
     * The default number of records to return from the database
     * when using the `findMany` adapter method.
     *
     * @default 100
     */
    defaultFindManyLimit?: number;
    /**
     * If your database auto increments number ids, set this to `true`.
     *
     * Note: If enabled, we will not handle ID generation (including if you use `generateId`), and it would be expected that your database will provide the ID automatically.
     *
     * @default false
     *
     * @deprecated Please use `generateId` instead. This will be removed in future
     * releases.
     */
    useNumberId?: boolean;
    /**
     * Custom generateId function.
     *
     * If not provided, random ids will be generated.
     * If set to false, the database's auto generated id
     * will be used.
     *
     * If set to "serial", the database's auto generated
     * id will be used.
     *
     * If set to "uuid", we generate a random UUID for
     * the id. If postgres, we use the `gen_random_uuid()
     * ` function. If mysql or mssql, we use the `uuid()`
     * function.
     */
    generateId?: GenerateIdFn | false | "serial" | "uuid";
  } | undefined;
  /**
   * Trusted proxy headers
   *
    * - `x-forwarded-host`
   * - `x-forwarded-proto`
   *
   * If set to `true` and no `baseURL` option is provided, we will use the headers to infer the
   * base URL.
   *
   * ⚠︎ This may expose your application to security vulnerabilities if not
   * used correctly. Please use this with caution.
   */
  trustedProxyHeaders?: boolean | undefined;
};
type BetterAuthOptions = {
  /**
   * The name of the application
   *
   * process.env.APP_NAME
   *
   * @default "Better Auth"
   */
  appName?: string | undefined;
  /**
   * Base URL for the Better Auth. This is typically the
   * root URL where your application server is hosted.
   * If not explicitly set,
   * the system will check the following environment variable:
   *
   * process.env.BETTER_AUTH_URL
   */
  baseURL?: string | undefined;
  /**
   * Base path for the Better Auth. This is typically
   * the path where the
   * Better Auth routes are mounted.
   *
   * @default "/api/auth"
   */
  basePath?: string | undefined;
  /**
   * The secret to use for encryption,
   * signing and hashing.
   *
   * By default Better Auth will look for
   * the following environment variables:
   * process.env.BETTER_AUTH_SECRET,
   * process.env.AUTH_SECRET
   * If none of these environment
   * variables are set,
   * it will default to
   * "better-auth-secret-123456789".
   *
   * on production if it's not set
   * it will throw an error.
   *
   * you can generate a good secret
   * using the following command:
   * @example
   * ```bash
   * openssl rand -base64 32
   * ```
   */
  secret?: string | undefined;
  /**
   * Database configuration
   */
  database?: (PostgresPool | MysqlPool | SqliteDatabase | Dialect | DBAdapterInstance | Database | DatabaseSync | {
    dialect: Dialect;
    type: KyselyDatabaseType;
    /**
     * casing for table names
     *
     * @default "camel"
     */
    casing?: "snake" | "camel";
    /**
     * Enable debug logs for the adapter
     *
     * @default false
     */
    debugLogs?: DBAdapterDebugLogOption;
    /**
     * Whether to execute multiple operations in a transaction.
     * If the database doesn't support transactions,
     * set this to `false` and operations will be executed sequentially.
     *
     * @default false
     */
    transaction?: boolean;
  } | {
    /**
     * Kysely instance
     */
    db: Kysely<any>;
    /**
     * Database type between postgres, mysql and sqlite
     */
    type: KyselyDatabaseType;
    /**
     * casing for table names
     *
     * @default "camel"
     */
    casing?: "snake" | "camel";
    /**
     * Enable debug logs for the adapter
     *
     * @default false
     */
    debugLogs?: DBAdapterDebugLogOption;
    /**
     * Whether to execute multiple operations in a transaction.
     * If the database doesn't support transactions,
     * set this to `false` and operations will be executed sequentially.
     *
     * @default false
     */
    transaction?: boolean;
  }) | undefined;
  /**
   * Secondary storage configuration
   *
   * This is used to store session and rate limit data.
   */
  secondaryStorage?: SecondaryStorage | undefined;
  /**
   * Email verification configuration
   */
  emailVerification?: {
    /**
     * Send a verification email
     * @param data the data object
     * @param request the request object
     */
    sendVerificationEmail?: (
    /**
     * @param user the user to send the
     * verification email to
     * @param url the URL to send the verification email to
     * it contains the token as well
     * @param token the token to send the verification email to
     */
    data: {
      user: User;
      url: string;
      token: string;
    },
    /**
     * The request object
     */
    request?: Request) => Promise<void>;
    /**
     * Send a verification email automatically
     * after sign up
     *
     * @default false
     */
    sendOnSignUp?: boolean;
    /**
     * Send a verification email automatically
     * on sign in when the user's email is not verified
     *
     * @default false
     */
    sendOnSignIn?: boolean;
    /**
     * Auto signin the user after they verify their email
     */
    autoSignInAfterVerification?: boolean;
    /**
     * Number of seconds the verification token is
     * valid for.
     * @default 3600 seconds (1 hour)
     */
    expiresIn?: number;
    /**
     * A function that is called when a user verifies their email
     * @param user the user that verified their email
     * @param request the request object
     */
    onEmailVerification?: (user: User, request?: Request) => Promise<void>;
    /**
     * A function that is called when a user's email is updated to verified
     * @param user the user that verified their email
     * @param request the request object
     */
    afterEmailVerification?: (user: User, request?: Request) => Promise<void>;
  } | undefined;
  /**
   * Email and password authentication
   */
  emailAndPassword?: {
    /**
     * Enable email and password authentication
     *
     * @default false
     */
    enabled: boolean;
    /**
     * Disable email and password sign up
     *
     * @default false
     */
    disableSignUp?: boolean;
    /**
     * Require email verification before a session
     * can be created for the user.
     *
     * if the user is not verified, the user will not be able to sign in
     * and on sign in attempts, the user will be prompted to verify their email.
     */
    requireEmailVerification?: boolean;
    /**
     * The maximum length of the password.
     *
     * @default 128
     */
    maxPasswordLength?: number;
    /**
     * The minimum length of the password.
     *
     * @default 8
     */
    minPasswordLength?: number;
    /**
     * send reset password
     */
    sendResetPassword?: (
    /**
     * @param user the user to send the
     * reset password email to
     * @param url the URL to send the reset password email to
     * @param token the token to send to the user (could be used instead of sending the url
     * if you need to redirect the user to custom route)
     */
    data: {
      user: User;
      url: string;
      token: string;
    },
    /**
     * The request object
     */
    request?: Request) => Promise<void>;
    /**
     * Number of seconds the reset password token is
     * valid for.
     * @default 1 hour (60 * 60)
     */
    resetPasswordTokenExpiresIn?: number;
    /**
     * A callback function that is triggered
     * when a user's password is changed successfully.
     */
    onPasswordReset?: (data: {
      user: User;
    }, request?: Request) => Promise<void>;
    /**
     * Password hashing and verification
     *
     * By default Scrypt is used for password hashing and
     * verification. You can provide your own hashing and
     * verification function. if you want to use a
     * different algorithm.
     */
    password?: {
      hash?: (password: string) => Promise<string>;
      verify?: (data: {
        hash: string;
        password: string;
      }) => Promise<boolean>;
    };
    /**
     * Automatically sign in the user after sign up
     *
     * @default true
     */
    autoSignIn?: boolean;
    /**
     * Whether to revoke all other sessions when resetting password
     * @default false
     */
    revokeSessionsOnPasswordReset?: boolean;
  } | undefined;
  /**
   * list of social providers
   */
  socialProviders?: SocialProviders | undefined;
  /**
   * List of Better Auth plugins
   */
  plugins?: ([] | BetterAuthPlugin[]) | undefined;
  /**
   * User configuration
   */
  user?: {
    /**
     * The model name for the user. Defaults to "user".
     */
    modelName?: string;
    /**
     * Map fields
     *
     * @example
     * ```ts
     * {
     *  userId: "user_id"
     * }
     * ```
     */
    fields?: Partial<Record<keyof OmitId<User>, string>>;
    /**
     * Additional fields for the user
     */
    additionalFields?: {
      [key: string]: DBFieldAttribute;
    };
    /**
     * Changing email configuration
     */
    changeEmail?: {
      /**
       * Enable changing email
       * @default false
       */
      enabled: boolean;
      /**
       * Send a verification email when the user changes their email.
       * @param data the data object
       * @param request the request object
       * @deprecated Use `sendChangeEmailConfirmation` instead
       */
      sendChangeEmailVerification?: (data: {
        user: User;
        newEmail: string;
        url: string;
        token: string;
      }, request?: Request) => Promise<void>;
      /**
       * Send a confirmation email to the old email address when the user changes their email.
       * @param data the data object
       * @param request the request object
       */
      sendChangeEmailConfirmation?: (data: {
        user: User;
        newEmail: string;
        url: string;
        token: string;
      }, request?: Request) => Promise<void>;
      /**
       * Update the email without verification if the user is not verified.
       * @default false
       */
      updateEmailWithoutVerification?: boolean;
    };
    /**
     * User deletion configuration
     */
    deleteUser?: {
      /**
       * Enable user deletion
       */
      enabled?: boolean;
      /**
       * Send a verification email when the user deletes their account.
       *
       * if this is not set, the user will be deleted immediately.
       * @param data the data object
       * @param request the request object
       */
      sendDeleteAccountVerification?: (data: {
        user: User;
        url: string;
        token: string;
      }, request?: Request) => Promise<void>;
      /**
       * A function that is called before a user is deleted.
       *
       * to interrupt with error you can throw `APIError`
       */
      beforeDelete?: (user: User, request?: Request) => Promise<void>;
      /**
       * A function that is called after a user is deleted.
       *
       * This is useful for cleaning up user data
       */
      afterDelete?: (user: User, request?: Request) => Promise<void>;
      /**
       * The expiration time for the delete token.
       *
       * @default 1 day (60 * 60 * 24) in seconds
       */
      deleteTokenExpiresIn?: number;
    };
  } | undefined;
  session?: {
    /**
     * The model name for the session.
     *
     * @default "session"
     */
    modelName?: string;
    /**
     * Map fields
     *
     * @example
     * ```ts
     * {
     *  userId: "user_id"
     * }
     */
    fields?: Partial<Record<keyof OmitId<Session>, string>>;
    /**
     * Expiration time for the session token. The value
     * should be in seconds.
     * @default 7 days (60 * 60 * 24 * 7)
     */
    expiresIn?: number;
    /**
     * How often the session should be refreshed. The value
     * should be in seconds.
     * If set 0 the session will be refreshed every time it is used.
     * @default 1 day (60 * 60 * 24)
     */
    updateAge?: number;
    /**
     * Disable session refresh so that the session is not updated
     * regardless of the `updateAge` option.
     *
     * @default false
     */
    disableSessionRefresh?: boolean;
    /**
     * Additional fields for the session
     */
    additionalFields?: {
      [key: string]: DBFieldAttribute;
    };
    /**
     * By default if secondary storage is provided
     * the session is stored in the secondary storage.
     *
     * Set this to true to store the session in the database
     * as well.
     *
     * Reads are always done from the secondary storage.
     *
     * @default false
     */
    storeSessionInDatabase?: boolean;
    /**
     * By default, sessions are deleted from the database when secondary storage
     * is provided when session is revoked.
     *
     * Set this to true to preserve session records in the database,
     * even if they are deleted from the secondary storage.
     *
     * @default false
     */
    preserveSessionInDatabase?: boolean;
    /**
     * Enable caching session in cookie
     */
    cookieCache?: {
      /**
       * max age of the cookie
       * @default 5 minutes (5 * 60)
       */
      maxAge?: number;
      /**
       * Enable caching session in cookie
       * @default false
       */
      enabled?: boolean;
      /**
       * Strategy for encoding/decoding cookie cache
       *
       * - "compact": Uses base64url encoding with HMAC-SHA256 signature (compact format, no JWT spec overhead)
       * - "jwt": Uses JWT with HMAC signature (no encryption, follows JWT spec)
       * - "jwe": Uses JWE (JSON Web Encryption) with A256CBC-HS512 and HKDF key derivation for secure encrypted tokens
       *
       * @default "compact"
       */
      strategy?: "compact" | "jwt" | "jwe";
      /**
       * Controls stateless cookie cache refresh behavior.
       *
       * When enabled, the cookie cache will be automatically refreshed before expiry
       * WITHOUT querying the database. This is essential for fully stateless or DB-less scenarios.
       *
       * - `false`: Disable automatic refresh. Cache is only invalidated when it reaches maxAge expiry.
       * - `true`: Enable automatic refresh with default settings (refreshes when 80% of maxAge is reached).
       * - `object`: Custom refresh configuration with either `updateAge` or `shouldRefresh` function
       *
       * Note: When the cache expires (reaches maxAge), it will attempt to fetch from database if available.
       * The refreshCache option is specifically for refreshing BEFORE expiry in a stateless manner.
       *
       * @default false
       */
      refreshCache?: boolean | {
        /**
         * Time in seconds before expiry when the cache should be refreshed.
         * For example, if maxAge is 300 (5 minutes) and updateAge is 60,
         * the cache will be refreshed when it has 60 seconds left before expiry.
         *
         * @default 20% of maxAge
         */
        updateAge?: number;
      };
      /**
       * Version of the cookie cache
       *
       * If a cookie cache version is changed, all existing cookie caches with the old version
       * will be invalidated.
       *
       * It can be a string or a function that returns a string or a promise that returns a string.
       * If it's a function, it will be called with the session and user data
       *
       * @default "1"
       */
      version?: string | ((session: Session & Record<string, any>, user: User & Record<string, any>) => string) | ((session: Session & Record<string, any>, user: User & Record<string, any>) => Promise<string>);
    };
    /**
     * The age of the session to consider it fresh.
     *
     * This is used to check if the session is fresh
     * for sensitive operations. (e.g. deleting an account)
     *
     * If the session is not fresh, the user should be prompted
     * to sign in again.
     *
     * If set to 0, the session will be considered fresh every time. (⚠︎ not recommended)
     *
     * @default 1 day (60 * 60 * 24)
     */
    freshAge?: number;
  } | undefined;
  account?: {
    /**
     * The model name for the account. Defaults to "account".
     */
    modelName?: string;
    /**
     * Map fields
     */
    fields?: Partial<Record<keyof OmitId<Account>, string>>;
    /**
     * Additional fields for the account
     */
    additionalFields?: {
      [key: string]: DBFieldAttribute;
    };
    /**
     * When enabled (true), the user account data (accessToken, idToken, refreshToken, etc.)
     * will be updated on sign in with the latest data from the provider.
     *
     * @default true
     */
    updateAccountOnSignIn?: boolean;
    /**
     * Configuration for account linking.
     */
    accountLinking?: {
      /**
       * Enable account linking
       *
       * @default true
       */
      enabled?: boolean;
      /**
       * List of trusted providers
       */
      trustedProviders?: Array<LiteralUnion<SocialProviderList[number] | "email-password", string>>;
      /**
       * If enabled (true), this will allow users to manually linking accounts with different email addresses than the main user.
       *
       * @default false
       *
       * ⚠️ Warning: enabling this might lead to account takeovers, so proceed with caution.
       */
      allowDifferentEmails?: boolean;
      /**
       * If enabled (true), this will allow users to unlink all accounts.
       *
       * @default false
       */
      allowUnlinkingAll?: boolean;
      /**
       * If enabled (true), this will update the user information based on the newly linked account
       *
       * @default false
       */
      updateUserInfoOnLink?: boolean;
    };
    /**
     * Encrypt OAuth tokens
     *
     * By default, OAuth tokens (access tokens, refresh tokens, ID tokens) are stored in plain text in the database.
     * This poses a security risk if your database is compromised, as attackers could gain access to user accounts
     * on external services.
     *
     * When enabled, tokens are encrypted using AES-256-GCM before storage, providing protection against:
     * - Database breaches and unauthorized access to raw token data
     * - Internal threats from database administrators or compromised credentials
     * - Token exposure in database backups and logs
     * @default false
     */
    encryptOAuthTokens?: boolean;
    /**
     * Skip state cookie check
     *
     * ⚠︎ this has security implications and should only be enabled if you know what you are doing.
     * @default false
     */
    skipStateCookieCheck?: boolean;
    /**
     * Strategy for storing OAuth state
     *
     * - "cookie": Store state in an encrypted cookie (stateless)
     * - "database": Store state in the database
     *
     * @default "cookie"
     */
    storeStateStrategy?: "database" | "cookie";
    /**
     * Store account data after oauth flow on a cookie
     *
     * This is useful for database-less flow
     *
     * @default false
     *
     * @note This is automatically set to true if you haven't passed a database
     */
    storeAccountCookie?: boolean;
  } | undefined;
  /**
   * Verification configuration
   */
  verification?: {
    /**
     * Change the modelName of the verification table
     */
    modelName?: string;
    /**
     * Map verification fields
     */
    fields?: Partial<Record<keyof OmitId<Verification>, string>>;
    /**
     * disable cleaning up expired values when a verification value is
     * fetched
     */
    disableCleanup?: boolean;
  } | undefined;
  /**
   * List of trusted origins.
   */
  trustedOrigins?: (string[] | ((request: Request) => string[] | Promise<string[]>)) | undefined;
  /**
   * Rate limiting configuration
   */
  rateLimit?: BetterAuthRateLimitOptions | undefined;
  /**
   * Advanced options
   */
  advanced?: BetterAuthAdvancedOptions | undefined;
  logger?: Logger | undefined;
  /**
   * allows you to define custom hooks that can be
   * executed during lifecycle of core database
   * operations.
   */
  databaseHooks?: {
    /**
     * User hooks
     */
    user?: {
      create?: {
        /**
         * Hook that is called before a user is created.
         * if the hook returns false, the user will not be created.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (user: User & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<User> & Record<string, any>;
        }>;
        /**
         * Hook that is called after a user is created.
         */
        after?: (user: User & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      update?: {
        /**
         * Hook that is called before a user is updated.
         * if the hook returns false, the user will not be updated.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (user: Partial<User> & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<User & Record<string, any>>;
        }>;
        /**
         * Hook that is called after a user is updated.
         */
        after?: (user: User & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      delete?: {
        /**
         * Hook that is called before a user is deleted.
         * if the hook returns false, the user will not be deleted.
         */
        before?: (user: User & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void>;
        /**
         * Hook that is called after a user is deleted.
         */
        after?: (user: User & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
    };
    /**
     * Session Hook
     */
    session?: {
      create?: {
        /**
         * Hook that is called before a session is created.
         * if the hook returns false, the session will not be created.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (session: Session & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Session> & Record<string, any>;
        }>;
        /**
         * Hook that is called after a session is created.
         */
        after?: (session: Session & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      /**
       * Update hook
       */
      update?: {
        /**
         * Hook that is called before a user is updated.
         * if the hook returns false, the session will not be updated.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (session: Partial<Session> & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Session & Record<string, any>>;
        }>;
        /**
         * Hook that is called after a session is updated.
         */
        after?: (session: Session & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      delete?: {
        /**
         * Hook that is called before a session is deleted.
         * if the hook returns false, the session will not be deleted.
         */
        before?: (session: Session & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void>;
        /**
         * Hook that is called after a session is deleted.
         */
        after?: (session: Session & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
    };
    /**
     * Account Hook
     */
    account?: {
      create?: {
        /**
         * Hook that is called before a account is created.
         * If the hook returns false, the account will not be created.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (account: Account, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Account> & Record<string, any>;
        }>;
        /**
         * Hook that is called after a account is created.
         */
        after?: (account: Account, context?: GenericEndpointContext) => Promise<void>;
      };
      /**
       * Update hook
       */
      update?: {
        /**
         * Hook that is called before a account is update.
         * If the hook returns false, the user will not be updated.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (account: Partial<Account> & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Account & Record<string, any>>;
        }>;
        /**
         * Hook that is called after a account is updated.
         */
        after?: (account: Account & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      delete?: {
        /**
         * Hook that is called before an account is deleted.
         * if the hook returns false, the account will not be deleted.
         */
        before?: (account: Account & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void>;
        /**
         * Hook that is called after an account is deleted.
         */
        after?: (account: Account & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
    };
    /**
     * Verification Hook
     */
    verification?: {
      create?: {
        /**
         * Hook that is called before a verification is created.
         * if the hook returns false, the verification will not be created.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (verification: Verification & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Verification> & Record<string, any>;
        }>;
        /**
         * Hook that is called after a verification is created.
         */
        after?: (verification: Verification & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      update?: {
        /**
         * Hook that is called before a verification is updated.
         * if the hook returns false, the verification will not be updated.
         * If the hook returns an object, it'll be used instead of the original data
         */
        before?: (verification: Partial<Verification> & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void | {
          data: Optional<Verification & Record<string, any>>;
        }>;
        /**
         * Hook that is called after a verification is updated.
         */
        after?: (verification: Verification & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
      delete?: {
        /**
         * Hook that is called before a verification is deleted.
         * if the hook returns false, the verification will not be deleted.
         */
        before?: (verification: Verification & Record<string, unknown>, context?: GenericEndpointContext) => Promise<boolean | void>;
        /**
         * Hook that is called after a verification is deleted.
         */
        after?: (verification: Verification & Record<string, unknown>, context?: GenericEndpointContext) => Promise<void>;
      };
    };
  } | undefined;
  /**
   * API error handling
   */
  onAPIError?: {
    /**
     * Throw an error on API error
     *
     * @default false
     */
    throw?: boolean;
    /**
     * Custom error handler
     *
     * @param error
     * @param ctx - Auth context
     */
    onError?: (error: unknown, ctx: AuthContext) => void | Promise<void>;
    /**
     * The URL to redirect to on error
     *
     * When errorURL is provided, the error will be added to the URL as a query parameter
     * and the user will be redirected to the errorURL.
     *
     * @default - "/api/auth/error"
     */
    errorURL?: string;
    /**
     * Configure the default error page provided by Better-Auth
     * Start your dev server and go to /api/auth/error to see the error page.
     */
    customizeDefaultErrorPage?: {
      colors?: {
        background?: string;
        foreground?: string;
        primary?: string;
        primaryForeground?: string;
        mutedForeground?: string;
        border?: string;
        destructive?: string;
        titleBorder?: string;
        titleColor?: string;
        gridColor?: string;
        cardBackground?: string;
        cornerBorder?: string;
      };
      size?: {
        radiusSm?: string;
        radiusMd?: string;
        radiusLg?: string;
        textSm?: string;
        text2xl?: string;
        text4xl?: string;
        text6xl?: string;
      };
      font?: {
        defaultFamily?: string;
        monoFamily?: string;
      };
      disableTitleBorder?: boolean;
      disableCornerDecorations?: boolean;
      disableBackgroundGrid?: boolean;
    };
  } | undefined;
  /**
   * Hooks
   */
  hooks?: {
    /**
     * Before a request is processed
     */
    before?: AuthMiddleware;
    /**
     * After a request is processed
     */
    after?: AuthMiddleware;
  } | undefined;
  /**
   * Disabled paths
   *
   * Paths you want to disable.
   */
  disabledPaths?: string[] | undefined;
  /**
   * Telemetry configuration
   */
  telemetry?: {
    /**
     * Enable telemetry collection
     *
     * @default false
     */
    enabled?: boolean;
    /**
     * Enable debug mode
     *
     * @default false
     */
    debug?: boolean;
  } | undefined;
  /**
   * Experimental features
   */
  experimental?: {
    /**
     * Enable experimental joins for your database adapter.
     *
     * 	Please read the adapter documentation for more information regarding joins before enabling this.
     * 	Not all adapters support joins.
     *
     * @default false
     */
    joins?: boolean;
  };
};
//#endregion
//#region src/types/context.d.ts
type GenericEndpointContext<Options extends BetterAuthOptions = BetterAuthOptions> = EndpointContext<string, any> & {
  context: AuthContext<Options>;
};
interface InternalAdapter<Options extends BetterAuthOptions = BetterAuthOptions> {
  createOAuthUser(user: Omit<User, "id" | "createdAt" | "updatedAt">, account: Omit<Account, "userId" | "id" | "createdAt" | "updatedAt"> & Partial<Account>): Promise<{
    user: User;
    account: Account;
  }>;
  createUser<T extends Record<string, any>>(user: Omit<User, "id" | "createdAt" | "updatedAt" | "emailVerified"> & Partial<User> & Record<string, any>): Promise<T & User>;
  createAccount<T extends Record<string, any>>(account: Omit<Account, "id" | "createdAt" | "updatedAt"> & Partial<Account> & T): Promise<T & Account>;
  listSessions(userId: string): Promise<Session[]>;
  listUsers(limit?: number | undefined, offset?: number | undefined, sortBy?: {
    field: string;
    direction: "asc" | "desc";
  } | undefined, where?: Where[] | undefined): Promise<User[]>;
  countTotalUsers(where?: Where[] | undefined): Promise<number>;
  deleteUser(userId: string): Promise<void>;
  createSession(userId: string, dontRememberMe?: boolean | undefined, override?: (Partial<Session> & Record<string, any>) | undefined, overrideAll?: boolean | undefined): Promise<Session>;
  findSession(token: string): Promise<{
    session: Session & Record<string, any>;
    user: User & Record<string, any>;
  } | null>;
  findSessions(sessionTokens: string[]): Promise<{
    session: Session;
    user: User;
  }[]>;
  updateSession(sessionToken: string, session: Partial<Session> & Record<string, any>): Promise<Session | null>;
  deleteSession(token: string): Promise<void>;
  deleteAccounts(userId: string): Promise<void>;
  deleteAccount(accountId: string): Promise<void>;
  deleteSessions(userIdOrSessionTokens: string | string[]): Promise<void>;
  findOAuthUser(email: string, accountId: string, providerId: string): Promise<{
    user: User;
    accounts: Account[];
  } | null>;
  findUserByEmail(email: string, options?: {
    includeAccounts: boolean;
  } | undefined): Promise<{
    user: User;
    accounts: Account[];
  } | null>;
  findUserById(userId: string): Promise<User | null>;
  linkAccount(account: Omit<Account, "id" | "createdAt" | "updatedAt"> & Partial<Account>): Promise<Account>;
  updateUser<T extends Record<string, any>>(userId: string, data: Partial<User> & Record<string, any>): Promise<User & T>;
  updateUserByEmail<T extends Record<string, any>>(email: string, data: Partial<User & Record<string, any>>): Promise<User & T>;
  updatePassword(userId: string, password: string): Promise<void>;
  findAccounts(userId: string): Promise<Account[]>;
  findAccount(accountId: string): Promise<Account | null>;
  findAccountByProviderId(accountId: string, providerId: string): Promise<Account | null>;
  findAccountByUserId(userId: string): Promise<Account[]>;
  updateAccount(id: string, data: Partial<Account>): Promise<Account>;
  createVerificationValue(data: Omit<Verification, "createdAt" | "id" | "updatedAt"> & Partial<Verification>): Promise<Verification>;
  findVerificationValue(identifier: string): Promise<Verification | null>;
  deleteVerificationValue(id: string): Promise<void>;
  deleteVerificationByIdentifier(identifier: string): Promise<void>;
  updateVerificationValue(id: string, data: Partial<Verification>): Promise<Verification>;
}
type CreateCookieGetterFn = (cookieName: string, overrideAttributes?: Partial<CookieOptions> | undefined) => {
  name: string;
  attributes: CookieOptions;
};
type CheckPasswordFn<Options extends BetterAuthOptions = BetterAuthOptions> = (userId: string, ctx: GenericEndpointContext<Options>) => Promise<boolean>;
type AuthContext<Options extends BetterAuthOptions = BetterAuthOptions> = {
  options: Options;
  appName: string;
  baseURL: string;
  trustedOrigins: string[];
  oauthConfig: {
    /**
     * This is dangerous and should only be used in dev or staging environments.
     */
    skipStateCookieCheck?: boolean | undefined;
    /**
     * Strategy for storing OAuth state
     *
     * - "cookie": Store state in an encrypted cookie (stateless)
     * - "database": Store state in the database
     *
     * @default "cookie"
     */
    storeStateStrategy: "database" | "cookie";
  };
  /**
   * New session that will be set after the request
   * meaning: there is a `set-cookie` header that will set
   * the session cookie. This is the fetched session. And it's set
   * by `setNewSession` method.
   */
  newSession: {
    session: Session & Record<string, any>;
    user: User & Record<string, any>;
  } | null;
  session: {
    session: Session & Record<string, any>;
    user: User & Record<string, any>;
  } | null;
  setNewSession: (session: {
    session: Session & Record<string, any>;
    user: User & Record<string, any>;
  } | null) => void;
  socialProviders: OAuthProvider[];
  authCookies: BetterAuthCookies;
  logger: ReturnType<typeof createLogger>;
  rateLimit: {
    enabled: boolean;
    window: number;
    max: number;
    storage: "memory" | "database" | "secondary-storage";
  } & BetterAuthRateLimitOptions;
  adapter: DBAdapter<Options>;
  internalAdapter: InternalAdapter<Options>;
  createAuthCookie: CreateCookieGetterFn;
  secret: string;
  sessionConfig: {
    updateAge: number;
    expiresIn: number;
    freshAge: number;
    cookieRefreshCache: false | {
      enabled: true;
      updateAge: number;
    };
  };
  generateId: (options: {
    model: LiteralUnion<DBPreservedModels, string>;
    size?: number | undefined;
  }) => string | false;
  secondaryStorage: SecondaryStorage | undefined;
  password: {
    hash: (password: string) => Promise<string>;
    verify: (data: {
      password: string;
      hash: string;
    }) => Promise<boolean>;
    config: {
      minPasswordLength: number;
      maxPasswordLength: number;
    };
    checkPassword: CheckPasswordFn<Options>;
  };
  tables: BetterAuthDBSchema;
  runMigrations: () => Promise<void>;
  publishTelemetry: (event: {
    type: string;
    anonymousId?: string | undefined;
    payload: Record<string, any>;
  }) => Promise<void>;
  /**
   * This skips the origin check for all requests.
   *
   * set to true by default for `test` environments and `false`
   * for other environments.
   *
   * It's inferred from the `options.advanced?.disableCSRFCheck`
   * option or `options.advanced?.disableOriginCheck` option.
   *
   * @default false
   */
  skipOriginCheck: boolean;
  /**
   * This skips the CSRF check for all requests.
   *
   * This is inferred from the `options.advanced?.
   * disableCSRFCheck` option.
   *
   * @default false
   */
  skipCSRFCheck: boolean;
};
//#endregion
//#region src/types/plugin-client.d.ts
interface ClientStore {
  notify: (signal: string) => void;
  listen: (signal: string, listener: () => void) => void;
  atoms: Record<string, WritableAtom<any>>;
}
type ClientAtomListener = {
  matcher: (path: string) => boolean;
  signal: "$sessionSignal" | Omit<string, "$sessionSignal">;
};
/**
 * Better-Fetch options but with additional options for the auth-client.
 */
type ClientFetchOption<Body = any, Query extends Record<string, any> = any, Params extends Record<string, any> | Array<string> | undefined = any, Res = any> = BetterFetchOption<Body, Query, Params, Res> & {
  /**
   * Certain endpoints, upon successful response, will trigger atom signals and thus rerendering all hooks related to that atom.
   *
   * This option is useful when you want to skip hook rerenders.
   */
  disableSignal?: boolean | undefined;
};
interface RevalidateOptions {
  /**
   * A time interval (in seconds) after which the session will be re-fetched.
   * If set to `0` (default), the session is not polled.
   *
   * This helps prevent session expiry during idle periods by periodically
   * refreshing the session.
   *
   * @default 0
   */
  refetchInterval?: number | undefined;
  /**
   * Automatically refetch the session when the user switches back to the window/tab.
   * This option activates this behavior if set to `true` (default).
   *
   * Prevents expired sessions when users switch tabs and come back later.
   *
   * @default true
   */
  refetchOnWindowFocus?: boolean | undefined;
  /**
   * Set to `false` to stop polling when the device has no internet access
   * (determined by `navigator.onLine`).
   *
   * @default false
   * @see https://developer.mozilla.org/en-US/docs/Web/API/NavigatorOnLine/onLine
   */
  refetchWhenOffline?: boolean | undefined;
}
interface BetterAuthClientOptions {
  fetchOptions?: ClientFetchOption | undefined;
  plugins?: BetterAuthClientPlugin[] | undefined;
  baseURL?: string | undefined;
  basePath?: string | undefined;
  disableDefaultFetchPlugins?: boolean | undefined;
  $InferAuth?: BetterAuthOptions | undefined;
  sessionOptions?: RevalidateOptions | undefined;
}
interface BetterAuthClientPlugin {
  id: LiteralString;
  /**
   * only used for type inference. don't pass the
   * actual plugin
   */
  $InferServerPlugin?: BetterAuthPlugin | undefined;
  /**
   * Custom actions
   */
  getActions?: ($fetch: BetterFetch, $store: ClientStore,
  /**
   * better-auth client options
   */
  options: BetterAuthClientOptions | undefined) => Record<string, any>;
  /**
   * State atoms that'll be resolved by each framework
   * auth store.
   */
  getAtoms?: (($fetch: BetterFetch) => Record<string, Atom<any>>) | undefined;
  /**
   * specify path methods for server plugin inferred
   * endpoints to force a specific method.
   */
  pathMethods?: Record<string, "POST" | "GET"> | undefined;
  /**
   * Better fetch plugins
   */
  fetchPlugins?: BetterFetchPlugin[] | undefined;
  /**
   * a list of recaller based on a matcher function.
   * The signal name needs to match a signal in this
   * plugin or any plugin the user might have added.
   */
  atomListeners?: ClientAtomListener[] | undefined;
}
//#endregion
//#region src/api/index.d.ts
declare const optionsMiddleware: <InputCtx extends better_call0.MiddlewareInputContext<better_call0.MiddlewareOptions>>(inputContext: InputCtx) => Promise<AuthContext>;
declare const createAuthMiddleware: {
  <Options extends better_call0.MiddlewareOptions, R>(options: Options, handler: (ctx: better_call0.MiddlewareContext<Options, AuthContext & {
    returned?: unknown | undefined;
    responseHeaders?: Headers | undefined;
  }>) => Promise<R>): (inputContext: better_call0.MiddlewareInputContext<Options>) => Promise<R>;
  <Options extends better_call0.MiddlewareOptions, R_1>(handler: (ctx: better_call0.MiddlewareContext<Options, AuthContext & {
    returned?: unknown | undefined;
    responseHeaders?: Headers | undefined;
  }>) => Promise<R_1>): (inputContext: better_call0.MiddlewareInputContext<Options>) => Promise<R_1>;
};
declare const createAuthEndpoint: <Path extends string, Opts extends EndpointOptions, R>(path: Path, options: Opts, handler: (ctx: EndpointContext<Path, Opts, AuthContext>) => Promise<R>) => better_call0.StrictEndpoint<Path, Opts & {
  use: any[];
}, R>;
type AuthEndpoint = ReturnType<typeof createAuthEndpoint>;
type AuthMiddleware = ReturnType<typeof createAuthMiddleware>;
//#endregion
export { AccountStatus as $, JoinConfig as $n, GoogleProfile as $t, PolarOptions as A, BetterAuthCookies as An, linear as At, LineIdTokenPayload as B, createClientCredentialsTokenRequest as Bn, TwitchOptions as Bt, SocialProviderListEnum as C, AppleNonConformUser as Cn, DBFieldType as Cr, gitlab as Ct, VercelOptions as D, getApplePublicKey as Dn, LinearOptions as Dt, socialProviders as E, apple as En, SecondaryStorage as Er, linkedin as Et, PayPalTokenResponse as F, getOAuth2Tokens as Fn, DropboxProfile as Ft, NaverProfile as G, CleanedWhere as Gn, spotify as Gt, LineUserInfo as H, OAuth2UserInfo as Hn, twitch as Ht, paypal as I, createRefreshAccessTokenRequest as In, dropbox as It, KakaoProfile as J, DBAdapterDebugLogOption as Jn, slack as Jt, naver as K, CustomAdapter as Kn, SlackOptions as Kt, PaybinOptions as L, refreshAccessToken as Ln, TwitterOption as Lt, polar as M, validateAuthorizationCode as Mn, KickProfile as Mt, PayPalOptions as N, validateToken as Nn, kick as Nt, VercelProfile as O, LiteralString as On, LinearProfile as Ot, PayPalProfile as P, generateCodeChallenge as Pn, DropboxOptions as Pt, notion as Q, DBTransactionAdapter as Qn, GoogleOptions as Qt, PaybinProfile as R, createAuthorizationURL as Rn, TwitterProfile as Rt, SocialProviderList as S, atlassian as Sn, DBFieldAttributeConfig as Sr, GitlabProfile as St, socialProviderList as T, AppleProfile as Tn, DBPrimitive as Tr, LinkedInProfile as Tt, line as U, OAuthProvider as Un, SpotifyOptions as Ut, LineOptions as V, OAuth2Tokens as Vn, TwitchProfile as Vt, NaverOptions as W, ProviderOptions as Wn, SpotifyProfile as Wt, NotionOptions as X, DBAdapterInstance as Xn, HuggingFaceProfile as Xt, kakao as Y, DBAdapterFactoryConfig as Yn, HuggingFaceOptions as Yt, NotionProfile as Z, DBAdapterSchemaCreation as Zn, huggingface as Zt, BetterAuthRateLimitOptions as _, CognitoProfile as _n, Account as _r, reddit as _t, optionsMiddleware as a, GithubProfile as an, FieldAttributeConfig as ar, zoom as at, HookEndpointContext as b, AtlassianOptions as bn, BetterAuthDBSchema as br, tiktok as bt, BetterAuthClientPlugin as c, FigmaProfile as cn, Verification as cr, vk as ct, ClientStore as d, FacebookProfile as dn, userSchema as dr, salesforce as dt, google as en, JoinOption as er, LoginType as et, AuthContext as f, facebook as fn, coreSchema as fr, RobloxOptions as ft, BetterAuthOptions as g, CognitoOptions as gn, rateLimitSchema as gr, RedditProfile as gt, BetterAuthAdvancedOptions as h, discord as hn, RateLimit as hr, RedditOptions as ht, createAuthMiddleware as i, GithubOptions as in, FieldAttribute as ir, ZoomProfile as it, PolarProfile as j, createAuthorizationCodeRequest as jn, KickOptions as jt, vercel as k, LiteralUnion as kn, LinearUser as kt, ClientAtomListener as l, figma as ln, verificationSchema as lr, SalesforceOptions as lt, InternalAdapter as m, DiscordProfile as mn, sessionSchema as mr, roblox as mt, AuthMiddleware as n, MicrosoftOptions as nn, AuthPluginSchema as nr, PronounOption as nt, StandardSchemaV1$1 as o, github as on, FieldType as or, VkOption as ot, GenericEndpointContext as p, DiscordOptions as pn, Session as pr, RobloxProfile as pt, KakaoOptions as q, DBAdapter as qn, SlackProfile as qt, createAuthEndpoint as r, microsoft as rn, BetterAuthDbSchema as rr, ZoomOptions as rt, BetterAuthClientOptions as s, FigmaOptions as sn, Primitive$1 as sr, VkProfile as st, AuthEndpoint as t, MicrosoftEntraIDProfile as tn, Where as tr, PhoneNumber as tt, ClientFetchOption as u, FacebookOptions as un, User as ur, SalesforceProfile as ut, GenerateIdFn as v, cognito as vn, accountSchema as vr, TiktokOptions as vt, SocialProviders as w, AppleOptions as wn, DBPreservedModels as wr, LinkedInOptions as wt, SocialProvider as x, AtlassianProfile as xn, DBFieldAttribute as xr, GitlabOptions as xt, BetterAuthPlugin as y, getCognitoPublicKey as yn, BetterAuthPluginDBSchema as yr, TiktokProfile as yt, paybin as z, clientCredentialsToken as zn, twitter as zt };