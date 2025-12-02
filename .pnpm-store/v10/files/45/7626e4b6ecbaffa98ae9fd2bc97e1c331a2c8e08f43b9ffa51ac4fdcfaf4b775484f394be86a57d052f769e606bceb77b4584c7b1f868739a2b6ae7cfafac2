import { n as __export, r as __reExport } from "./chunk-09eW3CcW.mjs";
import { t as KyselyDatabaseType } from "./types-CRiHq5rJ.mjs";
import { d as PrettifyDeep, h as UnionToIntersection, i as HasRequiredKeys, m as StripEmptyObjects, u as Prettify$1 } from "./helper-DU33OcfW.mjs";
import { n as InferPluginErrorCodes, t as InferOptionSchema } from "./plugins-Brc8BsoZ.mjs";
import { AuthContext, BetterAuthAdvancedOptions, BetterAuthClientOptions, BetterAuthClientOptions as BetterAuthClientOptions$1, BetterAuthClientPlugin, BetterAuthClientPlugin as BetterAuthClientPlugin$1, BetterAuthCookies as BetterAuthCookies$1, BetterAuthOptions, BetterAuthOptions as BetterAuthOptions$1, BetterAuthPlugin, BetterAuthPlugin as BetterAuthPlugin$1, BetterAuthRateLimitOptions, ClientAtomListener, ClientFetchOption, ClientStore, GenericEndpointContext, InternalAdapter, StandardSchemaV1 as StandardSchemaV1$1 } from "@better-auth/core";
import { getCurrentAdapter as getCurrentAdapter$1 } from "@better-auth/core/context";
import * as _better_auth_core_db9 from "@better-auth/core/db";
import { Account, BetterAuthDBSchema, BetterAuthPluginDBSchema, DBFieldAttribute, DBFieldAttributeConfig, DBFieldType, Primitive, RateLimit, Session, Session as Session$1, User, User as User$1, Verification } from "@better-auth/core/db";
import { InternalLogger } from "@better-auth/core/env";
import { BASE_ERROR_CODES } from "@better-auth/core/error";
import * as _better_auth_core_oauth28 from "@better-auth/core/oauth2";
import * as better_call693 from "better-call";
import { APIError as APIError$1, Endpoint, InputContext, StandardSchemaV1 } from "better-call";
import * as z from "zod";
import { JSONWebKeySet as JSONWebKeySet$1, JWTPayload as JWTPayload$1 } from "jose";
import { TelemetryEvent, createTelemetry as createTelemetry$1, getTelemetryAuthConfig } from "@better-auth/telemetry";
import { AuthEndpoint, AuthMiddleware, createAuthEndpoint as createAuthEndpoint$1, createAuthMiddleware as createAuthMiddleware$1, optionsMiddleware } from "@better-auth/core/api";
import * as nanostores13 from "nanostores";
import { Atom, PreinitializedWritableAtom, WritableAtom } from "nanostores";
import * as _better_fetch_fetch110 from "@better-fetch/fetch";
import { BetterFetch, BetterFetchError, BetterFetchResponse } from "@better-fetch/fetch";
import { DBAdapter, DBAdapter as DBAdapter$1, DBAdapterInstance, DBAdapterInstance as DBAdapterInstance$1, DBAdapterSchemaCreation, DBAdapterSchemaCreation as DBAdapterSchemaCreation$1, DBTransactionAdapter, DBTransactionAdapter as DBTransactionAdapter$1, Where, Where as Where$1 } from "@better-auth/core/db/adapter";
import * as _standard_schema_spec0 from "@standard-schema/spec";
import * as zod_v4_core0 from "zod/v4/core";

//#region src/db/adapter-base.d.ts
declare function getBaseAdapter(options: BetterAuthOptions, handleDirectDatabase: (options: BetterAuthOptions) => Promise<DBAdapter<BetterAuthOptions>>): Promise<DBAdapter<BetterAuthOptions>>;
//#endregion
//#region src/db/adapter-kysely.d.ts
declare function getAdapter(options: BetterAuthOptions): Promise<DBAdapter<BetterAuthOptions>>;
//#endregion
//#region src/db/field.d.ts
declare const createFieldAttribute: <T$1 extends DBFieldType, C$1 extends DBFieldAttributeConfig>(type: T$1, config?: C$1 | undefined) => {
  required?: boolean | undefined;
  returned?: boolean | undefined;
  input?: boolean | undefined;
  defaultValue?: (_better_auth_core_db9.DBPrimitive | (() => _better_auth_core_db9.DBPrimitive)) | undefined;
  onUpdate?: (() => _better_auth_core_db9.DBPrimitive) | undefined;
  transform?: {
    input?: (value: _better_auth_core_db9.DBPrimitive) => _better_auth_core_db9.DBPrimitive | Promise<_better_auth_core_db9.DBPrimitive>;
    output?: (value: _better_auth_core_db9.DBPrimitive) => _better_auth_core_db9.DBPrimitive | Promise<_better_auth_core_db9.DBPrimitive>;
  } | undefined;
  references?: {
    model: string;
    field: string;
    onDelete?: "no action" | "restrict" | "cascade" | "set null" | "set default";
  } | undefined;
  unique?: boolean | undefined;
  bigint?: boolean | undefined;
  validator?: {
    input?: _standard_schema_spec0.StandardSchemaV1;
    output?: _standard_schema_spec0.StandardSchemaV1;
  } | undefined;
  fieldName?: string | undefined;
  sortable?: boolean | undefined;
  index?: boolean | undefined;
  type: T$1;
};
type InferValueType<T$1 extends DBFieldType> = T$1 extends "string" ? string : T$1 extends "number" ? number : T$1 extends "boolean" ? boolean : T$1 extends "date" ? Date : T$1 extends "json" ? Record<string, any> : T$1 extends `${infer U}[]` ? U extends "string" ? string[] : number[] : T$1 extends Array<any> ? T$1[number] : never;
type InferFieldsOutput<Field$1> = Field$1 extends Record<infer Key, DBFieldAttribute> ? { [key in Key as Field$1[key]["returned"] extends false ? never : Field$1[key]["required"] extends false ? Field$1[key]["defaultValue"] extends boolean | string | number | Date ? key : never : key]: InferFieldOutput<Field$1[key]> } & { [key in Key as Field$1[key]["returned"] extends false ? never : Field$1[key]["required"] extends false ? Field$1[key]["defaultValue"] extends boolean | string | number | Date ? never : key : never]?: InferFieldOutput<Field$1[key]> | null } : {};
type InferFieldsInput<Field$1> = Field$1 extends Record<infer Key, DBFieldAttribute> ? { [key in Key as Field$1[key]["required"] extends false ? never : Field$1[key]["defaultValue"] extends string | number | boolean | Date ? never : Field$1[key]["input"] extends false ? never : key]: InferFieldInput<Field$1[key]> } & { [key in Key as Field$1[key]["input"] extends false ? never : key]?: InferFieldInput<Field$1[key]> | undefined | null } : {};
/**
 * For client will add "?" on optional fields
 */
type InferFieldsInputClient<Field$1> = Field$1 extends Record<infer Key, DBFieldAttribute> ? { [key in Key as Field$1[key]["required"] extends false ? never : Field$1[key]["defaultValue"] extends string | number | boolean | Date ? never : Field$1[key]["input"] extends false ? never : key]: InferFieldInput<Field$1[key]> } & { [key in Key as Field$1[key]["input"] extends false ? never : Field$1[key]["required"] extends false ? key : Field$1[key]["defaultValue"] extends string | number | boolean | Date ? key : never]?: InferFieldInput<Field$1[key]> | undefined | null } : {};
type InferFieldOutput<T$1 extends DBFieldAttribute> = T$1["returned"] extends false ? never : T$1["required"] extends false ? InferValueType<T$1["type"]> | undefined | null : InferValueType<T$1["type"]>;
/**
 * Converts a Record<string, DBFieldAttribute> to an object type
 * with keys and value types inferred from DBFieldAttribute["type"].
 */
type FieldAttributeToObject<Fields extends Record<string, DBFieldAttribute>> = AddOptionalFields<{ [K in keyof Fields]: InferValueType<Fields[K]["type"]> }, Fields>;
type AddOptionalFields<T$1 extends Record<string, any>, Fields extends Record<keyof T$1, DBFieldAttribute>> = { [K in keyof T$1 as Fields[K] extends {
  required: true;
} ? K : never]: T$1[K] } & { [K in keyof T$1 as Fields[K] extends {
  required: true;
} ? never : K]?: T$1[K] };
/**
 * Infer the additional fields from the plugin options.
 * For example, you can infer the additional fields of the org plugin's organization schema like this:
 * ```ts
 * type AdditionalFields = InferAdditionalFieldsFromPluginOptions<"organization", OrganizationOptions>
 * ```
 */
type InferAdditionalFieldsFromPluginOptions<SchemaName extends string, Options extends {
  schema?: { [key in SchemaName]?: {
    additionalFields?: Record<string, DBFieldAttribute>;
  } } | undefined;
}, isClientSide$1 extends boolean = true> = Options["schema"] extends { [key in SchemaName]?: {
  additionalFields: infer Field extends Record<string, DBFieldAttribute>;
} } ? isClientSide$1 extends true ? FieldAttributeToObject<RemoveFieldsWithInputFalse<Field>> : FieldAttributeToObject<Field> : {};
type RemoveFieldsWithInputFalse<T$1 extends Record<string, DBFieldAttribute>> = { [K in keyof T$1 as T$1[K]["input"] extends false ? never : K]: T$1[K] };
type InferFieldInput<T$1 extends DBFieldAttribute> = InferValueType<T$1["type"]>;
type PluginFieldAttribute = Omit<DBFieldAttribute, "transform" | "defaultValue" | "hashValue">;
type InferFieldsFromPlugins<Options extends BetterAuthOptions, Key$1 extends string, Format extends "output" | "input"> = Options["plugins"] extends [] ? {} : Options["plugins"] extends Array<infer T> ? T extends {
  schema: { [key in Key$1]: {
    fields: infer Field;
  } };
} ? Format extends "output" ? InferFieldsOutput<Field> : InferFieldsInput<Field> : {} : {};
type InferFieldsFromOptions<Options extends BetterAuthOptions, Key$1 extends "session" | "user", Format extends "output" | "input"> = Options[Key$1] extends {
  additionalFields: infer Field;
} ? Format extends "output" ? InferFieldsOutput<Field> : InferFieldsInput<Field> : {};
//#endregion
//#region src/db/field-converter.d.ts
declare function convertToDB<T$1 extends Record<string, any>>(fields: Record<string, DBFieldAttribute>, values: T$1): T$1;
declare function convertFromDB<T$1 extends Record<string, any>>(fields: Record<string, DBFieldAttribute>, values: T$1 | null): T$1 | null;
//#endregion
//#region src/db/get-migration.d.ts
declare function matchType(columnDataType: string, fieldType: DBFieldType, dbType: KyselyDatabaseType): boolean;
declare function getMigrations(config: BetterAuthOptions): Promise<{
  toBeCreated: {
    table: string;
    fields: Record<string, DBFieldAttribute>;
    order: number;
  }[];
  toBeAdded: {
    table: string;
    fields: Record<string, DBFieldAttribute>;
    order: number;
  }[];
  runMigrations: () => Promise<void>;
  compileMigrations: () => Promise<string>;
}>;
//#endregion
//#region src/db/get-schema.d.ts
declare function getSchema(config: BetterAuthOptions): Record<string, {
  fields: Record<string, DBFieldAttribute>;
  order: number;
}>;
//#endregion
//#region src/db/get-tables.d.ts
declare const getAuthTables: (options: BetterAuthOptions) => BetterAuthDBSchema;
//#endregion
//#region src/db/internal-adapter.d.ts
declare const createInternalAdapter: (adapter: DBAdapter<BetterAuthOptions>, ctx: {
  options: Omit<BetterAuthOptions, "logger">;
  logger: InternalLogger;
  hooks: Exclude<BetterAuthOptions["databaseHooks"], undefined>[];
  generateId: AuthContext["generateId"];
}) => InternalAdapter;
//#endregion
//#region src/db/schema.d.ts
declare function parseUserOutput(options: BetterAuthOptions, user: User$1): {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null | undefined;
};
declare function parseAccountOutput(options: BetterAuthOptions, account: Account): {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  providerId: string;
  accountId: string;
  userId: string;
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  idToken?: string | null | undefined;
  accessTokenExpiresAt?: Date | null | undefined;
  refreshTokenExpiresAt?: Date | null | undefined;
  scope?: string | null | undefined;
  password?: string | null | undefined;
};
declare function parseSessionOutput(options: BetterAuthOptions, session: Session$1): {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
};
declare function parseInputData<T$1 extends Record<string, any>>(data: T$1, schema: {
  fields: Record<string, DBFieldAttribute>;
  action?: ("create" | "update") | undefined;
}): Partial<T$1>;
declare function parseUserInput(options: BetterAuthOptions, user: Record<string, any> | undefined, action: "create" | "update"): Partial<Record<string, any>>;
declare function parseAdditionalUserInput(options: BetterAuthOptions, user?: Record<string, any> | undefined): Partial<Record<string, any>>;
declare function parseAccountInput(options: BetterAuthOptions, account: Partial<Account>): Partial<Partial<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  providerId: string;
  accountId: string;
  userId: string;
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  idToken?: string | null | undefined;
  accessTokenExpiresAt?: Date | null | undefined;
  refreshTokenExpiresAt?: Date | null | undefined;
  scope?: string | null | undefined;
  password?: string | null | undefined;
}>>;
declare function parseSessionInput(options: BetterAuthOptions, session: Partial<Session$1>): Partial<Partial<{
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  expiresAt: Date;
  token: string;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}>>;
declare function mergeSchema<S$1 extends BetterAuthPluginDBSchema>(schema: S$1, newSchema?: { [K in keyof S$1]?: {
  modelName?: string;
  fields?: {
    [P: string]: string;
  };
} } | undefined): S$1;
//#endregion
//#region src/db/to-zod.d.ts
declare function toZodSchema<Fields extends Record<string, DBFieldAttribute | never>, IsClientSide extends boolean>({
  fields,
  isClientSide
}: {
  fields: Fields;
  /**
   * If true, then any fields that have `input: false` will be removed from the schema to prevent user input.
   */
  isClientSide: IsClientSide;
}): z.ZodObject<RemoveNeverProps<{ [key in keyof Fields]: FieldAttributeToSchema<Fields[key], IsClientSide> }>, z.core.$strip>;
type FieldAttributeToSchema<Field$1 extends DBFieldAttribute | Record<string, never>, isClientSide$1 extends boolean = false> = Field$1 extends {
  type: any;
} ? GetInput<isClientSide$1, Field$1, GetRequired<Field$1, GetType<Field$1>>> : Record<string, never>;
type GetType<F extends DBFieldAttribute> = F extends {
  type: "string";
} ? z.ZodString : F extends {
  type: "number";
} ? z.ZodNumber : F extends {
  type: "boolean";
} ? z.ZodBoolean : F extends {
  type: "date";
} ? z.ZodDate : z.ZodAny;
type GetRequired<F extends DBFieldAttribute, Schema extends z.core.SomeType> = F extends {
  required: true;
} ? Schema : z.ZodOptional<Schema>;
type GetInput<isClientSide$1 extends boolean, Field$1 extends DBFieldAttribute, Schema extends z.core.SomeType> = Field$1 extends {
  input: false;
} ? isClientSide$1 extends true ? never : Schema : Schema;
type RemoveNeverProps<T$1> = { [K in keyof T$1 as [T$1[K]] extends [never] ? never : K]: T$1[K] };
//#endregion
//#region src/db/with-hooks.d.ts
declare function getWithHooks(adapter: DBAdapter<BetterAuthOptions>, ctx: {
  options: BetterAuthOptions;
  hooks: Exclude<BetterAuthOptions["databaseHooks"], undefined>[];
}): {
  createWithHooks: <T$1 extends Record<string, any>>(data: T$1, model: "session" | "user" | "account" | "verification", customCreateFn?: {
    fn: (data: Record<string, any>) => void | Promise<any>;
    executeMainFn?: boolean;
  } | undefined) => Promise<any>;
  updateWithHooks: <T$1 extends Record<string, any>>(data: any, where: Where[], model: "session" | "user" | "account" | "verification", customUpdateFn?: {
    fn: (data: Record<string, any>) => void | Promise<any>;
    executeMainFn?: boolean;
  } | undefined) => Promise<any>;
  updateManyWithHooks: <T$1 extends Record<string, any>>(data: any, where: Where[], model: "session" | "user" | "account" | "verification", customUpdateFn?: {
    fn: (data: Record<string, any>) => void | Promise<any>;
    executeMainFn?: boolean;
  } | undefined) => Promise<any>;
  deleteWithHooks: <T$1 extends Record<string, any>>(where: Where[], model: "session" | "user" | "account" | "verification", customDeleteFn?: {
    fn: (where: Where[]) => void | Promise<any>;
    executeMainFn?: boolean;
  } | undefined) => Promise<any>;
  deleteManyWithHooks: <T$1 extends Record<string, any>>(where: Where[], model: "session" | "user" | "account" | "verification", customDeleteFn?: {
    fn: (where: Where[]) => void | Promise<any>;
    executeMainFn?: boolean;
  } | undefined) => Promise<any>;
};
//#endregion
//#region src/client/path-to-object.d.ts
type CamelCase<S$1 extends string> = S$1 extends `${infer P1}-${infer P2}${infer P3}` ? `${Lowercase<P1>}${Uppercase<P2>}${CamelCase<P3>}` : Lowercase<S$1>;
type PathToObject<T$1 extends string, Fn extends (...args: any[]) => any> = T$1 extends `/${infer Segment}/${infer Rest}` ? { [K in CamelCase<Segment>]: PathToObject<`/${Rest}`, Fn> } : T$1 extends `/${infer Segment}` ? { [K in CamelCase<Segment>]: Fn } : never;
type InferSignUpEmailCtx<ClientOpts extends BetterAuthClientOptions, FetchOptions extends ClientFetchOption> = {
  email: string;
  name: string;
  password: string;
  image?: string | undefined;
  callbackURL?: string | undefined;
  fetchOptions?: FetchOptions | undefined;
} & UnionToIntersection<InferAdditionalFromClient<ClientOpts, "user", "input">>;
type InferUserUpdateCtx<ClientOpts extends BetterAuthClientOptions, FetchOptions extends ClientFetchOption> = {
  image?: (string | null) | undefined;
  name?: string | undefined;
  fetchOptions?: FetchOptions | undefined;
} & Partial<UnionToIntersection<InferAdditionalFromClient<ClientOpts, "user", "input">>>;
type InferCtx<C$1 extends InputContext<any, any>, FetchOptions extends ClientFetchOption> = C$1["body"] extends Record<string, any> ? C$1["body"] & {
  fetchOptions?: FetchOptions | undefined;
} : C$1["query"] extends Record<string, any> ? {
  query: C$1["query"];
  fetchOptions?: FetchOptions | undefined;
} : C$1["query"] extends Record<string, any> | undefined ? {
  query?: C$1["query"] | undefined;
  fetchOptions?: FetchOptions | undefined;
} : {
  fetchOptions?: FetchOptions | undefined;
};
type MergeRoutes<T$1> = UnionToIntersection<T$1>;
type InferRoute<API, COpts extends BetterAuthClientOptions> = API extends Record<string, infer T> ? T extends Endpoint ? T["options"]["metadata"] extends {
  isAction: false;
} | {
  SERVER_ONLY: true;
} ? {} : PathToObject<T["path"], T extends ((ctx: infer C) => infer R) ? C extends InputContext<any, any> ? <FetchOptions extends ClientFetchOption<Partial<C["body"]> & Record<string, any>, Partial<C["query"]> & Record<string, any>, C["params"]>>(...data: HasRequiredKeys<InferCtx<C, FetchOptions>> extends true ? [Prettify$1<T["path"] extends `/sign-up/email` ? InferSignUpEmailCtx<COpts, FetchOptions> : InferCtx<C, FetchOptions>>, FetchOptions?] : [Prettify$1<T["path"] extends `/update-user` ? InferUserUpdateCtx<COpts, FetchOptions> : InferCtx<C, FetchOptions>>?, FetchOptions?]) => Promise<BetterFetchResponse<T["options"]["metadata"] extends {
  CUSTOM_SESSION: boolean;
} ? NonNullable<Awaited<R>> : T["path"] extends "/get-session" ? {
  user: InferUserFromClient<COpts>;
  session: InferSessionFromClient<COpts>;
} | null : NonNullable<Awaited<R>>, T["options"]["error"] extends StandardSchemaV1 ? NonNullable<T["options"]["error"]["~standard"]["types"]>["output"] : {
  code?: string | undefined;
  message?: string | undefined;
}, FetchOptions["throw"] extends true ? true : COpts["fetchOptions"] extends {
  throw: true;
} ? true : false>> : never : never> : {} : never;
type InferRoutes<API extends Record<string, Endpoint>, ClientOpts extends BetterAuthClientOptions> = MergeRoutes<InferRoute<API, ClientOpts>>;
//#endregion
//#region src/client/types.d.ts
/**
 * @deprecated use type `BetterAuthClientOptions` instead.
 */
type Store$1 = ClientStore;
/**
 * @deprecated use type `ClientAtomListener` instead.
 */
type AtomListener = ClientAtomListener;
/**
 * @deprecated use type `BetterAuthClientPlugin` instead.
 */
type ClientOptions = BetterAuthClientOptions$1;
type InferClientAPI<O extends BetterAuthClientOptions$1> = InferRoutes<O["plugins"] extends Array<any> ? Auth["api"] & (O["plugins"] extends Array<infer Pl> ? UnionToIntersection<Pl extends {
  $InferServerPlugin: infer Plug;
} ? Plug extends {
  endpoints: infer Endpoints;
} ? Endpoints : {} : {}> : {}) : Auth["api"], O>;
type InferActions<O extends BetterAuthClientOptions$1> = (O["plugins"] extends Array<infer Plugin> ? UnionToIntersection<Plugin extends BetterAuthClientPlugin$1 ? Plugin["getActions"] extends ((...args: any) => infer Actions) ? Actions : {} : {}> : {}) & InferRoutes<O["$InferAuth"] extends {
  plugins: infer Plugins;
} ? Plugins extends Array<infer Plugin> ? Plugin extends {
  endpoints: infer Endpoints;
} ? Endpoints : {} : {} : {}, O>;
type InferErrorCodes<O extends BetterAuthClientOptions$1> = O["plugins"] extends Array<infer Plugin> ? UnionToIntersection<Plugin extends BetterAuthClientPlugin$1 ? Plugin["$InferServerPlugin"] extends BetterAuthPlugin ? Plugin["$InferServerPlugin"]["$ERROR_CODES"] : {} : {}> : {};
/**
 * signals are just used to recall a computed value.
 * as a convention they start with "$"
 */
type IsSignal<T$1> = T$1 extends `$${infer _}` ? true : false;
type InferPluginsFromClient<O extends BetterAuthClientOptions$1> = O["plugins"] extends Array<BetterAuthClientPlugin$1> ? Array<O["plugins"][number]["$InferServerPlugin"]> : undefined;
type InferSessionFromClient<O extends BetterAuthClientOptions$1> = StripEmptyObjects<Session$1 & UnionToIntersection<InferAdditionalFromClient<O, "session", "output">>>;
type InferUserFromClient<O extends BetterAuthClientOptions$1> = StripEmptyObjects<User$1 & UnionToIntersection<InferAdditionalFromClient<O, "user", "output">>>;
type InferAdditionalFromClient<Options extends BetterAuthClientOptions$1, Key$1 extends string, Format extends "input" | "output" = "output"> = Options["plugins"] extends Array<infer T> ? T extends BetterAuthClientPlugin$1 ? T["$InferServerPlugin"] extends {
  schema: { [key in Key$1]: {
    fields: infer Field;
  } };
} ? Format extends "input" ? InferFieldsInputClient<Field> : InferFieldsOutput<Field> : {} : {} : {};
type SessionQueryParams = {
  disableCookieCache?: boolean | undefined;
  disableRefresh?: boolean | undefined;
};
//#endregion
//#region src/types/adapter.d.ts
/**
 * Adapter Interface
 *
 * @deprecated Use `DBAdapter` from `@better-auth/core/db/adapter` instead.
 */
type Adapter = DBAdapter;
/**
 * @deprecated Use `DBTransactionAdapter` from `@better-auth/core/db/adapter` instead.
 */
type TransactionAdapter = DBTransactionAdapter;
/**
 * @deprecated Use `DBAdapterSchemaCreation` from `@better-auth/core/db/adapter` instead.
 */
type AdapterSchemaCreation = DBAdapterSchemaCreation;
/**
 * @deprecated Use `DBAdapterInstance` from `@better-auth/core/db/adapter` instead.
 */
type AdapterInstance = DBAdapterInstance;
//#endregion
//#region src/types/api.d.ts
type FilteredAPI<API> = Omit<API, API extends { [key in infer K]: Endpoint } ? K extends string ? K extends "getSession" ? K : API[K]["options"]["metadata"] extends {
  isAction: false;
} ? K : never : never : never>;
type FilterActions<API> = Omit<API, API extends { [key in infer K]: Endpoint } ? K extends string ? API[K]["options"]["metadata"] extends {
  isAction: false;
} ? K : never : never : never>;
type InferSessionAPI<API> = API extends {
  [key: string]: infer E;
} ? UnionToIntersection<E extends Endpoint ? E["path"] extends "/get-session" ? {
  getSession: <R$1 extends boolean, H extends boolean = false>(context: {
    headers: Headers;
    query?: {
      disableCookieCache?: boolean;
      disableRefresh?: boolean;
    } | undefined;
    asResponse?: R$1 | undefined;
    returnHeaders?: H | undefined;
  }) => false extends R$1 ? H extends true ? Promise<{
    headers: Headers;
    response: PrettifyDeep<Awaited<ReturnType<E>>> | null;
  }> : Promise<PrettifyDeep<Awaited<ReturnType<E>>> | null> : Promise<Response>;
} : never : never> : never;
type InferAPI<API> = InferSessionAPI<API> & API;
//#endregion
//#region src/auth/auth.d.ts
/**
 * Better Auth initializer for full mode (with Kysely)
 *
 * Check `minimal.ts` for minimal mode (without Kysely)
 */
declare const betterAuth: <Options extends BetterAuthOptions>(options: Options & Record<never, never>) => Auth<Options>;
//#endregion
//#region src/oauth2/state.d.ts
declare function generateState(c: GenericEndpointContext, link: {
  email: string;
  userId: string;
} | undefined, additionalData: Record<string, any> | false | undefined): Promise<{
  state: string;
  codeVerifier: string;
}>;
declare function parseState(c: GenericEndpointContext): Promise<{
  [x: string]: unknown;
  callbackURL: string;
  codeVerifier: string;
  expiresAt: number;
  errorURL?: string | undefined;
  newUserURL?: string | undefined;
  link?: {
    email: string;
    userId: string;
  } | undefined;
  requestSignUp?: boolean | undefined;
}>;
//#endregion
//#region src/utils/hide-metadata.d.ts
declare const HIDE_METADATA: {
  isAction: false;
};
//#endregion
//#region src/utils/id.d.ts
declare const generateId: (size?: number) => string;
//#endregion
//#region src/utils/misc.d.ts
declare function capitalizeFirstLetter(str: string): string;
declare namespace index_d_exports {
  export { APIError$1 as APIError, Account, Adapter, AdapterInstance, AdapterSchemaCreation, AdditionalSessionFieldsInput, AdditionalSessionFieldsOutput, AdditionalUserFieldsInput, AdditionalUserFieldsOutput, AtomListener, Auth, BetterAuthAdvancedOptions, BetterAuthClientOptions$1 as BetterAuthClientOptions, BetterAuthClientPlugin$1 as BetterAuthClientPlugin, BetterAuthCookies$1 as BetterAuthCookies, BetterAuthOptions$1 as BetterAuthOptions, BetterAuthPlugin$1 as BetterAuthPlugin, BetterAuthRateLimitOptions, ClientAtomListener, ClientOptions, ClientStore, DBAdapter$1 as DBAdapter, DBAdapterInstance$1 as DBAdapterInstance, DBAdapterSchemaCreation$1 as DBAdapterSchemaCreation, DBTransactionAdapter$1 as DBTransactionAdapter, FilterActions, FilteredAPI, HIDE_METADATA, InferAPI, InferActions, InferAdditionalFromClient, InferClientAPI, InferErrorCodes, InferOptionSchema, InferPluginErrorCodes, InferPluginTypes, InferPluginsFromClient, InferSession, InferSessionAPI, InferSessionFromClient, InferUser, InferUserFromClient, IsSignal, JSONWebKeySet$1 as JSONWebKeySet, JWTPayload$1 as JWTPayload, RateLimit, Session$1 as Session, SessionQueryParams, StandardSchemaV1$1 as StandardSchemaV1, Store$1 as Store, TelemetryEvent, TransactionAdapter, User$1 as User, Verification, Where$1 as Where, betterAuth, capitalizeFirstLetter, createTelemetry$1 as createTelemetry, generateId, generateState, getCurrentAdapter$1 as getCurrentAdapter, getTelemetryAuthConfig, parseState };
}
import * as import___better_auth_core from "@better-auth/core";
import * as import___better_auth_core_db from "@better-auth/core/db";
import * as import___better_auth_core_env from "@better-auth/core/env";
import * as import___better_auth_core_error from "@better-auth/core/error";
import * as import___better_auth_core_oauth2 from "@better-auth/core/oauth2";
import * as import___better_auth_core_utils from "@better-auth/core/utils";
import * as import_better_call from "better-call";
import * as import_zod from "zod";
import * as import_zod_v4 from "zod/v4";
import * as import_zod_v4_core from "zod/v4/core";
//#endregion
//#region src/client/broadcast-channel.d.ts
interface BroadcastMessage {
  event?: "session" | undefined;
  data?: {
    trigger?: "signout" | "getSession" | "updateUser";
  } | undefined;
  clientId: string;
  timestamp: number;
}
type BroadcastListener = (message: BroadcastMessage) => void;
declare const kBroadcastChannel: unique symbol;
interface BroadcastChannel {
  post(message: Record<string, unknown>): void;
  subscribe(listener: BroadcastListener): () => void;
  setup(): () => void;
}
declare function getGlobalBroadcastChannel(name?: string): BroadcastChannel;
//#endregion
//#region src/client/focus-manager.d.ts
type FocusListener = (focused: boolean) => void;
declare const kFocusManager: unique symbol;
interface FocusManager {
  setFocused(focused: boolean): void;
  subscribe(listener: FocusListener): () => void;
  setup(): () => void;
}
//#endregion
//#region src/client/online-manager.d.ts
type OnlineListener = (online: boolean) => void;
declare const kOnlineManager: unique symbol;
interface OnlineManager {
  setOnline(online: boolean): void;
  isOnline: boolean;
  subscribe(listener: OnlineListener): () => void;
  setup(): () => void;
}
//#endregion
//#region src/client/query.d.ts
declare const useAuthQuery: <T$1>(initializedAtom: PreinitializedWritableAtom<any> | PreinitializedWritableAtom<any>[], path: string, $fetch: BetterFetch, options?: (((value: {
  data: null | T$1;
  error: null | BetterFetchError;
  isPending: boolean;
}) => ClientFetchOption) | ClientFetchOption) | undefined) => PreinitializedWritableAtom<{
  data: null | T$1;
  error: null | BetterFetchError;
  isPending: boolean;
  isRefetching: boolean;
  refetch: (queryParams?: {
    query?: SessionQueryParams;
  } | undefined) => Promise<void>;
}> & object;
//#endregion
//#region src/client/session-refresh.d.ts
interface SessionRefreshOptions {
  sessionAtom: WritableAtom<any>;
  sessionSignal: WritableAtom<boolean>;
  $fetch: BetterFetch;
  options?: BetterAuthClientOptions | undefined;
}
declare function createSessionRefreshManager(opts: SessionRefreshOptions): {
  init: () => void;
  cleanup: () => void;
  triggerRefetch: (event?: {
    event?: "poll" | "visibilitychange" | "storage";
  } | undefined) => void;
  broadcastSessionUpdate: (trigger: "signout" | "getSession" | "updateUser") => void;
};
//#endregion
//#region src/client/vanilla.d.ts
type InferResolvedHooks<O extends BetterAuthClientOptions> = O extends {
  plugins: Array<infer Plugin>;
} ? UnionToIntersection<Plugin extends BetterAuthClientPlugin ? Plugin["getAtoms"] extends ((fetch: any) => infer Atoms) ? Atoms extends Record<string, any> ? { [key in keyof Atoms as IsSignal<key> extends true ? never : key extends string ? `use${Capitalize<key>}` : never]: Atoms[key] } : {} : {} : {}> : {};
declare function createAuthClient<Option extends BetterAuthClientOptions>(options?: Option | undefined): UnionToIntersection<InferResolvedHooks<Option>> & InferClientAPI<Option> & InferActions<Option> & {
  useSession: Atom<{
    data: InferClientAPI<Option> extends {
      getSession: () => Promise<infer Res>;
    } ? Res extends {
      data: null;
      error: {
        message?: string | undefined;
        status: number;
        statusText: string;
      };
    } | {
      data: infer S;
      error: null;
    } ? S : Res extends Record<string, any> ? Res : never : never;
    error: BetterFetchError | null;
    isPending: boolean;
  }>;
  $fetch: _better_fetch_fetch110.BetterFetch<{
    plugins: (_better_fetch_fetch110.BetterFetchPlugin | {
      id: string;
      name: string;
      hooks: {
        onSuccess(context: _better_fetch_fetch110.SuccessContext<any>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onRequest<T$1 extends Record<string, any>>(context: _better_fetch_fetch110.RequestContext<T$1>): void;
      };
    } | {
      id: string;
      name: string;
      hooks: {
        onSuccess: ((context: _better_fetch_fetch110.SuccessContext<any>) => Promise<void> | void) | undefined;
        onError: ((context: _better_fetch_fetch110.ErrorContext) => Promise<void> | void) | undefined;
        onRequest: (<T$1 extends Record<string, any>>(context: _better_fetch_fetch110.RequestContext<T$1>) => Promise<_better_fetch_fetch110.RequestContext | void> | _better_fetch_fetch110.RequestContext | void) | undefined;
        onResponse: ((context: _better_fetch_fetch110.ResponseContext) => Promise<Response | void | _better_fetch_fetch110.ResponseContext> | Response | _better_fetch_fetch110.ResponseContext | void) | undefined;
      };
    })[];
    cache?: RequestCache | undefined;
    method: string;
    headers?: (HeadersInit & (HeadersInit | {
      accept: "application/json" | "text/plain" | "application/octet-stream";
      "content-type": "application/json" | "text/plain" | "application/x-www-form-urlencoded" | "multipart/form-data" | "application/octet-stream";
      authorization: "Bearer" | "Basic";
    })) | undefined;
    redirect?: RequestRedirect | undefined;
    credentials?: RequestCredentials;
    integrity?: string | undefined;
    keepalive?: boolean | undefined;
    mode?: RequestMode | undefined;
    priority?: RequestPriority | undefined;
    referrer?: string | undefined;
    referrerPolicy?: ReferrerPolicy | undefined;
    signal?: (AbortSignal | null) | undefined;
    window?: null | undefined;
    onRetry?: ((response: _better_fetch_fetch110.ResponseContext) => Promise<void> | void) | undefined;
    hookOptions?: {
      cloneResponse?: boolean;
    } | undefined;
    timeout?: number | undefined;
    customFetchImpl: _better_fetch_fetch110.FetchEsque;
    baseURL: string;
    throw?: boolean | undefined;
    auth?: ({
      type: "Bearer";
      token: string | Promise<string | undefined> | (() => string | Promise<string | undefined> | undefined) | undefined;
    } | {
      type: "Basic";
      username: string | (() => string | undefined) | undefined;
      password: string | (() => string | undefined) | undefined;
    } | {
      type: "Custom";
      prefix: string | (() => string | undefined) | undefined;
      value: string | (() => string | undefined) | undefined;
    }) | undefined;
    body?: any;
    query?: any;
    params?: any;
    duplex?: "full" | "half" | undefined;
    jsonParser: (text: string) => Promise<any> | any;
    retry?: _better_fetch_fetch110.RetryOptions | undefined;
    retryAttempt?: number | undefined;
    output?: (_better_fetch_fetch110.StandardSchemaV1 | typeof Blob | typeof File) | undefined;
    errorSchema?: _better_fetch_fetch110.StandardSchemaV1 | undefined;
    disableValidation?: boolean | undefined;
    disableSignal?: boolean | undefined;
  }, unknown, unknown, {}>;
  $store: {
    notify: (signal?: (Omit<string, "$sessionSignal"> | "$sessionSignal") | undefined) => void;
    listen: (signal: Omit<string, "$sessionSignal"> | "$sessionSignal", listener: (value: boolean, oldValue?: boolean | undefined) => void) => void;
    atoms: Record<string, nanostores13.WritableAtom<any>>;
  };
  $Infer: {
    Session: NonNullable<InferClientAPI<Option> extends {
      getSession: () => Promise<infer Res>;
    } ? Res extends {
      data: null;
      error: {
        message?: string | undefined;
        status: number;
        statusText: string;
      };
    } | {
      data: infer S;
      error: null;
    } ? S : Res extends Record<string, any> ? Res : never : never>;
  };
  $ERROR_CODES: PrettifyDeep<InferErrorCodes<Option> & typeof BASE_ERROR_CODES>;
};
type AuthClient<Option extends BetterAuthClientOptions> = ReturnType<typeof createAuthClient<Option>>;
//#endregion
//#region src/client/index.d.ts
declare const InferPlugin: <T$1 extends BetterAuthPlugin>() => {
  id: "infer-server-plugin";
  $InferServerPlugin: T$1;
};
declare function InferAuth<O extends {
  options: BetterAuthOptions;
}>(): O["options"];
//#endregion
//#region src/utils/get-request-ip.d.ts
declare function getIp(req: Request | Headers, options: BetterAuthOptions): string | null;
//#endregion
//#region src/api/middlewares/oauth.d.ts
type OAuthState = {
  callbackURL: string;
  codeVerifier: string;
  errorURL?: string;
  newUserURL?: string;
  link?: {
    email: string;
    userId: string;
  };
  expiresAt: number;
  requestSignUp?: boolean;
  [key: string]: any;
};
declare const getOAuthState: () => Promise<OAuthState | null>, setOAuthState: (value: OAuthState | null) => Promise<void>;
//#endregion
//#region src/api/middlewares/origin-check.d.ts
/**
 * A middleware to validate callbackURL and origin against
 * trustedOrigins.
 */
declare const originCheckMiddleware: (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>;
declare const originCheck: (getValue: (ctx: GenericEndpointContext) => string | string[]) => (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>;
//#endregion
//#region src/api/routes/account.d.ts
declare const listUserAccounts: better_call693.StrictEndpoint<"/list-accounts", {
  method: "GET";
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  type: string;
                  properties: {
                    id: {
                      type: string;
                    };
                    providerId: {
                      type: string;
                    };
                    createdAt: {
                      type: string;
                      format: string;
                    };
                    updatedAt: {
                      type: string;
                      format: string;
                    };
                    accountId: {
                      type: string;
                    };
                    userId: {
                      type: string;
                    };
                    scopes: {
                      type: string;
                      items: {
                        type: string;
                      };
                    };
                  };
                  required: string[];
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  id: string;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
  accountId: string;
  userId: string;
  scopes: string[];
}[]>;
declare const linkSocialAccount: better_call693.StrictEndpoint<"/link-social", {
  method: "POST";
  requireHeaders: true;
  body: z.ZodObject<{
    callbackURL: z.ZodOptional<z.ZodString>;
    provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, z.core.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
    idToken: z.ZodOptional<z.ZodObject<{
      token: z.ZodString;
      nonce: z.ZodOptional<z.ZodString>;
      accessToken: z.ZodOptional<z.ZodString>;
      refreshToken: z.ZodOptional<z.ZodString>;
      scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    }, z.core.$strip>>;
    requestSignUp: z.ZodOptional<z.ZodBoolean>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    errorCallbackURL: z.ZodOptional<z.ZodString>;
    disableRedirect: z.ZodOptional<z.ZodBoolean>;
    additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      description: string;
      operationId: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  url: {
                    type: string;
                    description: string;
                  };
                  redirect: {
                    type: string;
                    description: string;
                  };
                  status: {
                    type: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  url: string;
  redirect: boolean;
}>;
declare const unlinkAccount: better_call693.StrictEndpoint<"/unlink-account", {
  method: "POST";
  body: z.ZodObject<{
    providerId: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const getAccessToken: better_call693.StrictEndpoint<"/get-access-token", {
  method: "POST";
  body: z.ZodObject<{
    providerId: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      description: string;
      responses: {
        200: {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  tokenType: {
                    type: string;
                  };
                  idToken: {
                    type: string;
                  };
                  accessToken: {
                    type: string;
                  };
                  refreshToken: {
                    type: string;
                  };
                  accessTokenExpiresAt: {
                    type: string;
                    format: string;
                  };
                  refreshTokenExpiresAt: {
                    type: string;
                    format: string;
                  };
                };
              };
            };
          };
        };
        400: {
          description: string;
        };
      };
    };
  };
} & {
  use: any[];
}, {
  accessToken: string;
  accessTokenExpiresAt: Date | undefined;
  scopes: string[];
  idToken: string | undefined;
}>;
declare const refreshToken: better_call693.StrictEndpoint<"/refresh-token", {
  method: "POST";
  body: z.ZodObject<{
    providerId: z.ZodString;
    accountId: z.ZodOptional<z.ZodString>;
    userId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      description: string;
      responses: {
        200: {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  tokenType: {
                    type: string;
                  };
                  idToken: {
                    type: string;
                  };
                  accessToken: {
                    type: string;
                  };
                  refreshToken: {
                    type: string;
                  };
                  accessTokenExpiresAt: {
                    type: string;
                    format: string;
                  };
                  refreshTokenExpiresAt: {
                    type: string;
                    format: string;
                  };
                };
              };
            };
          };
        };
        400: {
          description: string;
        };
      };
    };
  };
} & {
  use: any[];
}, {
  accessToken: string | undefined;
  refreshToken: string | undefined;
  accessTokenExpiresAt: Date | undefined;
  refreshTokenExpiresAt: Date | undefined;
  scope: string | null | undefined;
  idToken: string | null | undefined;
  providerId: string;
  accountId: string;
}>;
declare const accountInfo: better_call693.StrictEndpoint<"/account-info", {
  method: "GET";
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  user: {
                    type: string;
                    properties: {
                      id: {
                        type: string;
                      };
                      name: {
                        type: string;
                      };
                      email: {
                        type: string;
                      };
                      image: {
                        type: string;
                      };
                      emailVerified: {
                        type: string;
                      };
                    };
                    required: string[];
                  };
                  data: {
                    type: string;
                    properties: {};
                    additionalProperties: boolean;
                  };
                };
                required: string[];
                additionalProperties: boolean;
              };
            };
          };
        };
      };
    };
  };
  query: z.ZodOptional<z.ZodObject<{
    accountId: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
} & {
  use: any[];
}, {
  user: _better_auth_core_oauth28.OAuth2UserInfo;
  data: Record<string, any>;
} | null>;
//#endregion
//#region src/api/routes/callback.d.ts
declare const callbackOAuth: better_call693.StrictEndpoint<"/callback/:id", {
  method: ("GET" | "POST")[];
  operationId: string;
  body: z.ZodOptional<z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    device_id: z.ZodOptional<z.ZodString>;
    error_description: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  query: z.ZodOptional<z.ZodObject<{
    code: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodString>;
    device_id: z.ZodOptional<z.ZodString>;
    error_description: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    user: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  metadata: {
    allowedMediaTypes: string[];
    isAction: false;
  };
} & {
  use: any[];
}, void>;
//#endregion
//#region src/api/routes/email-verification.d.ts
declare function createEmailVerificationToken(secret: string, email: string,
/**
 * The email to update from
 */
updateTo?: string | undefined,
/**
 * The time in seconds for the token to expire
 */
expiresIn?: number,
/**
 * Extra payload to include in the token
 */
extraPayload?: Record<string, any>): Promise<string>;
/**
 * A function to send a verification email to the user
 */
declare function sendVerificationEmailFn(ctx: GenericEndpointContext, user: User$1): Promise<void>;
declare const sendVerificationEmail: better_call693.StrictEndpoint<"/send-verification-email", {
  method: "POST";
  operationId: string;
  body: z.ZodObject<{
    email: z.ZodEmail;
    callbackURL: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                email: {
                  type: string;
                  description: string;
                  example: string;
                };
                callbackURL: {
                  type: string;
                  description: string;
                  example: string;
                  nullable: boolean;
                };
              };
              required: string[];
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                    description: string;
                    example: boolean;
                  };
                };
              };
            };
          };
        };
        "400": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  message: {
                    type: string;
                    description: string;
                    example: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const verifyEmail: better_call693.StrictEndpoint<"/verify-email", {
  method: "GET";
  operationId: string;
  query: z.ZodObject<{
    token: z.ZodString;
    callbackURL: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
  metadata: {
    openapi: {
      description: string;
      parameters: ({
        name: string;
        in: "query";
        description: string;
        required: true;
        schema: {
          type: "string";
        };
      } | {
        name: string;
        in: "query";
        description: string;
        required: false;
        schema: {
          type: "string";
        };
      })[];
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  user: {
                    type: string;
                    $ref: string;
                  };
                  status: {
                    type: string;
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, void | {
  status: boolean;
}>;
//#endregion
//#region src/api/routes/error.d.ts
declare const error: better_call693.StrictEndpoint<"/error", {
  method: "GET";
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "text/html": {
              schema: {
                type: "string";
                description: string;
              };
            };
          };
        };
      };
    };
    isAction: false;
  };
} & {
  use: any[];
}, Response>;
//#endregion
//#region src/api/routes/ok.d.ts
declare const ok: better_call693.StrictEndpoint<"/ok", {
  method: "GET";
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  ok: {
                    type: string;
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
    isAction: false;
  };
} & {
  use: any[];
}, {
  ok: boolean;
}>;
//#endregion
//#region src/api/routes/reset-password.d.ts
declare const requestPasswordReset: better_call693.StrictEndpoint<"/request-password-reset", {
  method: "POST";
  operationId: string;
  body: z.ZodObject<{
    email: z.ZodEmail;
    redirectTo: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                  };
                  message: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
  message: string;
}>;
declare const requestPasswordResetCallback: better_call693.StrictEndpoint<"/reset-password/:token", {
  method: "GET";
  operationId: string;
  query: z.ZodObject<{
    callbackURL: z.ZodString;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      parameters: ({
        name: string;
        in: "path";
        required: true;
        description: string;
        schema: {
          type: "string";
        };
      } | {
        name: string;
        in: "query";
        required: true;
        description: string;
        schema: {
          type: "string";
        };
      })[];
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  token: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, never>;
declare const resetPassword: better_call693.StrictEndpoint<"/reset-password", {
  method: "POST";
  operationId: string;
  query: z.ZodOptional<z.ZodObject<{
    token: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>>;
  body: z.ZodObject<{
    newPassword: z.ZodString;
    token: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
//#endregion
//#region src/api/routes/session.d.ts
declare const getSession: <Option extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/get-session", {
  method: "GET";
  operationId: string;
  query: z.ZodOptional<z.ZodObject<{
    disableCookieCache: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
    disableRefresh: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
  }, z.core.$strip>>;
  requireHeaders: true;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  session: {
                    $ref: string;
                  };
                  user: {
                    $ref: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  session: InferSession<Option>;
  user: InferUser<Option>;
} | null>;
declare const getSessionFromCtx: <U$1 extends Record<string, any> = Record<string, any>, S$1 extends Record<string, any> = Record<string, any>>(ctx: GenericEndpointContext, config?: {
  disableCookieCache?: boolean;
  disableRefresh?: boolean;
} | undefined) => Promise<{
  session: S$1 & Session$1;
  user: U$1 & User$1;
} | null>;
/**
 * The middleware forces the endpoint to require a valid session.
 */
declare const sessionMiddleware: (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
  session: {
    session: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
    user: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    };
  };
}>;
/**
 * This middleware forces the endpoint to require a valid session and ignores cookie cache.
 * This should be used for sensitive operations like password changes, account deletion, etc.
 * to ensure that revoked sessions cannot be used even if they're still cached in cookies.
 */
declare const sensitiveSessionMiddleware: (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
  session: {
    session: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
    user: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    };
  };
}>;
/**
 * This middleware allows you to call the endpoint on the client if session is valid.
 * However, if called on the server, no session is required.
 */
declare const requestOnlySessionMiddleware: (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
  session: {
    session: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
    user: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    };
  } | null;
}>;
/**
 * This middleware forces the endpoint to require a valid session,
 * as well as making sure the session is fresh before proceeding.
 *
 * Session freshness check will be skipped if the session config's freshAge
 * is set to 0
 */
declare const freshSessionMiddleware: (inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
  session: {
    session: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    };
    user: Record<string, any> & {
      id: string;
      createdAt: Date;
      updatedAt: Date;
      email: string;
      emailVerified: boolean;
      name: string;
      image?: string | null | undefined;
    };
  };
}>;
/**
 * user active sessions list
 */
declare const listSessions: <Option extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/list-sessions", {
  method: "GET";
  operationId: string;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  requireHeaders: true;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "array";
                items: {
                  $ref: string;
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, Prettify$1<InferSession<Option>>[]>;
/**
 * revoke a single session
 */
declare const revokeSession: better_call693.StrictEndpoint<"/revoke-session", {
  method: "POST";
  body: z.ZodObject<{
    token: z.ZodString;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  requireHeaders: true;
  metadata: {
    openapi: {
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                token: {
                  type: string;
                  description: string;
                };
              };
              required: string[];
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
/**
 * revoke all user sessions
 */
declare const revokeSessions: better_call693.StrictEndpoint<"/revoke-sessions", {
  method: "POST";
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  requireHeaders: true;
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const revokeOtherSessions: better_call693.StrictEndpoint<"/revoke-other-sessions", {
  method: "POST";
  requireHeaders: true;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  status: {
                    type: string;
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
//#endregion
//#region src/api/routes/sign-in.d.ts
declare const socialSignInBodySchema: z.ZodObject<{
  callbackURL: z.ZodOptional<z.ZodString>;
  newUserCallbackURL: z.ZodOptional<z.ZodString>;
  errorCallbackURL: z.ZodOptional<z.ZodString>;
  provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, z.core.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
  disableRedirect: z.ZodOptional<z.ZodBoolean>;
  idToken: z.ZodOptional<z.ZodObject<{
    token: z.ZodString;
    nonce: z.ZodOptional<z.ZodString>;
    accessToken: z.ZodOptional<z.ZodString>;
    refreshToken: z.ZodOptional<z.ZodString>;
    expiresAt: z.ZodOptional<z.ZodNumber>;
  }, z.core.$strip>>;
  scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
  requestSignUp: z.ZodOptional<z.ZodBoolean>;
  loginHint: z.ZodOptional<z.ZodString>;
  additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
declare const signInSocial: <O extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/sign-in/social", {
  method: "POST";
  operationId: string;
  body: z.ZodObject<{
    callbackURL: z.ZodOptional<z.ZodString>;
    newUserCallbackURL: z.ZodOptional<z.ZodString>;
    errorCallbackURL: z.ZodOptional<z.ZodString>;
    provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, z.core.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
    disableRedirect: z.ZodOptional<z.ZodBoolean>;
    idToken: z.ZodOptional<z.ZodObject<{
      token: z.ZodString;
      nonce: z.ZodOptional<z.ZodString>;
      accessToken: z.ZodOptional<z.ZodString>;
      refreshToken: z.ZodOptional<z.ZodString>;
      expiresAt: z.ZodOptional<z.ZodNumber>;
    }, z.core.$strip>>;
    scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
    requestSignUp: z.ZodOptional<z.ZodBoolean>;
    loginHint: z.ZodOptional<z.ZodString>;
    additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }, z.core.$strip>;
  metadata: {
    $Infer: {
      body: z.infer<typeof socialSignInBodySchema>;
      returned: {
        redirect: boolean;
        token?: string | undefined;
        url?: string | undefined;
        user?: InferUser<O> | undefined;
      };
    };
    openapi: {
      description: string;
      operationId: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                description: string;
                properties: {
                  token: {
                    type: string;
                  };
                  user: {
                    type: string;
                    $ref: string;
                  };
                  url: {
                    type: string;
                  };
                  redirect: {
                    type: string;
                    enum: boolean[];
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  redirect: boolean;
  url: string;
} | {
  redirect: boolean;
  token: string;
  url: undefined;
  user: InferUser<O>;
}>;
declare const signInEmail: <O extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/sign-in/email", {
  method: "POST";
  operationId: string;
  body: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    callbackURL: z.ZodOptional<z.ZodString>;
    rememberMe: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
  }, z.core.$strip>;
  metadata: {
    $Infer: {
      body: {
        email: string;
        password: string;
        callbackURL?: string | undefined;
        rememberMe?: boolean | undefined;
      };
      returned: {
        redirect: boolean;
        token: string;
        url?: string | undefined;
        user: InferUser<O>;
      };
    };
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                description: string;
                properties: {
                  redirect: {
                    type: string;
                    enum: boolean[];
                  };
                  token: {
                    type: string;
                    description: string;
                  };
                  url: {
                    type: string;
                    nullable: boolean;
                  };
                  user: {
                    type: string;
                    $ref: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  redirect: boolean;
  token: string;
  url?: string | undefined;
  user: InferUser<O>;
}>;
//#endregion
//#region src/api/routes/sign-out.d.ts
declare const signOut: better_call693.StrictEndpoint<"/sign-out", {
  method: "POST";
  operationId: string;
  requireHeaders: true;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  success: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  success: boolean;
}>;
//#endregion
//#region src/api/routes/sign-up.d.ts
declare const signUpEmail: <O extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/sign-up/email", {
  method: "POST";
  operationId: string;
  body: z.ZodRecord<z.ZodString, z.ZodAny>;
  metadata: {
    $Infer: {
      body: {
        name: string;
        email: string;
        password: string;
        image?: string | undefined;
        callbackURL?: string | undefined;
        rememberMe?: boolean | undefined;
      } & AdditionalUserFieldsInput<O>;
      returned: {
        token: string | null;
        user: InferUser<O>;
      };
    };
    openapi: {
      operationId: string;
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                name: {
                  type: string;
                  description: string;
                };
                email: {
                  type: string;
                  description: string;
                };
                password: {
                  type: string;
                  description: string;
                };
                image: {
                  type: string;
                  description: string;
                };
                callbackURL: {
                  type: string;
                  description: string;
                };
                rememberMe: {
                  type: string;
                  description: string;
                };
              };
              required: string[];
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  token: {
                    type: string;
                    nullable: boolean;
                    description: string;
                  };
                  user: {
                    type: string;
                    properties: {
                      id: {
                        type: string;
                        description: string;
                      };
                      email: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        description: string;
                      };
                      image: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      emailVerified: {
                        type: string;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
                required: string[];
              };
            };
          };
        };
        "422": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  message: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  token: null;
  user: InferUser<O>;
} | {
  token: string;
  user: InferUser<O>;
}>;
//#endregion
//#region src/api/routes/update-user.d.ts
declare const updateUser: <O extends BetterAuthOptions>() => better_call693.StrictEndpoint<"/update-user", {
  method: "POST";
  operationId: string;
  body: z.ZodRecord<z.ZodString, z.ZodAny>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    $Infer: {
      body: Partial<AdditionalUserFieldsInput<O>> & {
        name?: string | undefined;
        image?: string | undefined;
      };
    };
    openapi: {
      operationId: string;
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                name: {
                  type: string;
                  description: string;
                };
                image: {
                  type: string;
                  description: string;
                };
              };
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  user: {
                    type: string;
                    $ref: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const changePassword: better_call693.StrictEndpoint<"/change-password", {
  method: "POST";
  operationId: string;
  body: z.ZodObject<{
    newPassword: z.ZodString;
    currentPassword: z.ZodString;
    revokeOtherSessions: z.ZodOptional<z.ZodBoolean>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  token: {
                    type: string;
                    nullable: boolean;
                    description: string;
                  };
                  user: {
                    type: string;
                    properties: {
                      id: {
                        type: string;
                        description: string;
                      };
                      email: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      name: {
                        type: string;
                        description: string;
                      };
                      image: {
                        type: string;
                        format: string;
                        nullable: boolean;
                        description: string;
                      };
                      emailVerified: {
                        type: string;
                        description: string;
                      };
                      createdAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                      updatedAt: {
                        type: string;
                        format: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  token: string | null;
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null | undefined;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  };
}>;
declare const setPassword: better_call693.StrictEndpoint<"/set-password", {
  method: "POST";
  body: z.ZodObject<{
    newPassword: z.ZodString;
  }, z.core.$strip>;
  metadata: {
    SERVER_ONLY: true;
  };
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
} & {
  use: any[];
}, {
  status: boolean;
}>;
declare const deleteUser: better_call693.StrictEndpoint<"/delete-user", {
  method: "POST";
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  body: z.ZodObject<{
    callbackURL: z.ZodOptional<z.ZodString>;
    password: z.ZodOptional<z.ZodString>;
    token: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  metadata: {
    openapi: {
      operationId: string;
      description: string;
      requestBody: {
        content: {
          "application/json": {
            schema: {
              type: "object";
              properties: {
                callbackURL: {
                  type: string;
                  description: string;
                };
                password: {
                  type: string;
                  description: string;
                };
                token: {
                  type: string;
                  description: string;
                };
              };
            };
          };
        };
      };
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  success: {
                    type: string;
                    description: string;
                  };
                  message: {
                    type: string;
                    enum: string[];
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  success: boolean;
  message: string;
}>;
declare const deleteUserCallback: better_call693.StrictEndpoint<"/delete-user/callback", {
  method: "GET";
  query: z.ZodObject<{
    token: z.ZodString;
    callbackURL: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
  metadata: {
    openapi: {
      description: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  success: {
                    type: string;
                    description: string;
                  };
                  message: {
                    type: string;
                    enum: string[];
                    description: string;
                  };
                };
                required: string[];
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  success: boolean;
  message: string;
}>;
declare const changeEmail: better_call693.StrictEndpoint<"/change-email", {
  method: "POST";
  body: z.ZodObject<{
    newEmail: z.ZodEmail;
    callbackURL: z.ZodOptional<z.ZodString>;
  }, z.core.$strip>;
  use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
    session: {
      session: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      };
      user: Record<string, any> & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      };
    };
  }>)[];
  metadata: {
    openapi: {
      operationId: string;
      responses: {
        "200": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  user: {
                    type: string;
                    $ref: string;
                  };
                  status: {
                    type: string;
                    description: string;
                  };
                  message: {
                    type: string;
                    enum: string[];
                    description: string;
                    nullable: boolean;
                  };
                };
                required: string[];
              };
            };
          };
        };
        "422": {
          description: string;
          content: {
            "application/json": {
              schema: {
                type: "object";
                properties: {
                  message: {
                    type: string;
                  };
                };
              };
            };
          };
        };
      };
    };
  };
} & {
  use: any[];
}, {
  status: boolean;
}>;
//#endregion
//#region src/api/index.d.ts
declare function checkEndpointConflicts(options: BetterAuthOptions, logger: InternalLogger): void;
declare function getEndpoints<Option extends BetterAuthOptions>(ctx: Promise<AuthContext> | AuthContext, options: Option): {
  api: {
    readonly ok: better_call693.StrictEndpoint<"/ok", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      ok: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, {
      ok: boolean;
    }>;
    readonly error: better_call693.StrictEndpoint<"/error", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "text/html": {
                  schema: {
                    type: "string";
                    description: string;
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, Response>;
    readonly signInSocial: better_call693.StrictEndpoint<"/sign-in/social", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        newUserCallbackURL: z.ZodOptional<z.ZodString>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        disableRedirect: z.ZodOptional<z.ZodBoolean>;
        idToken: z.ZodOptional<z.ZodObject<{
          token: z.ZodString;
          nonce: z.ZodOptional<z.ZodString>;
          accessToken: z.ZodOptional<z.ZodString>;
          refreshToken: z.ZodOptional<z.ZodString>;
          expiresAt: z.ZodOptional<z.ZodNumber>;
        }, zod_v4_core0.$strip>>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        requestSignUp: z.ZodOptional<z.ZodBoolean>;
        loginHint: z.ZodOptional<z.ZodString>;
        additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        $Infer: {
          body: z.infer<z.ZodObject<{
            callbackURL: z.ZodOptional<z.ZodString>;
            newUserCallbackURL: z.ZodOptional<z.ZodString>;
            errorCallbackURL: z.ZodOptional<z.ZodString>;
            provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: z.ZodOptional<z.ZodBoolean>;
            idToken: z.ZodOptional<z.ZodObject<{
              token: z.ZodString;
              nonce: z.ZodOptional<z.ZodString>;
              accessToken: z.ZodOptional<z.ZodString>;
              refreshToken: z.ZodOptional<z.ZodString>;
              expiresAt: z.ZodOptional<z.ZodNumber>;
            }, zod_v4_core0.$strip>>;
            scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            requestSignUp: z.ZodOptional<z.ZodBoolean>;
            loginHint: z.ZodOptional<z.ZodString>;
            additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
          }, zod_v4_core0.$strip>>;
          returned: {
            redirect: boolean;
            token?: string | undefined;
            url?: string | undefined;
            user?: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>> | undefined;
          };
        };
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      token: {
                        type: string;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                      url: {
                        type: string;
                      };
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      redirect: boolean;
      url: string;
    } | {
      redirect: boolean;
      token: string;
      url: undefined;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly callbackOAuth: better_call693.StrictEndpoint<"/callback/:id", {
      method: ("GET" | "POST")[];
      operationId: string;
      body: z.ZodOptional<z.ZodObject<{
        code: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        error_description: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      query: z.ZodOptional<z.ZodObject<{
        code: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        error_description: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      metadata: {
        allowedMediaTypes: string[];
        isAction: false;
      };
    } & {
      use: any[];
    }, void>;
    readonly getSession: better_call693.StrictEndpoint<"/get-session", {
      method: "GET";
      operationId: string;
      query: z.ZodOptional<z.ZodObject<{
        disableCookieCache: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
        disableRefresh: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
      }, zod_v4_core0.$strip>>;
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      session: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalSessionFieldsOutput<Option> : Option extends Auth ? AdditionalSessionFieldsOutput<Option["options"]> : {})>>;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    } | null>;
    readonly signOut: better_call693.StrictEndpoint<"/sign-out", {
      method: "POST";
      operationId: string;
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
    }>;
    readonly signUpEmail: better_call693.StrictEndpoint<"/sign-up/email", {
      method: "POST";
      operationId: string;
      body: z.ZodRecord<z.ZodString, z.ZodAny>;
      metadata: {
        $Infer: {
          body: {
            name: string;
            email: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          } & InferFieldsFromPlugins<Option, "user", "input"> & InferFieldsFromOptions<Option, "user", "input">;
          returned: {
            token: string | null;
            user: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    email: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    rememberMe: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
                            type: string;
                            description: string;
                          };
                          createdAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          updatedAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                        };
                        required: string[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      token: null;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    } | {
      token: string;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly signInEmail: better_call693.StrictEndpoint<"/sign-in/email", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
        rememberMe: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        $Infer: {
          body: {
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            redirect: boolean;
            token: string;
            url?: string | undefined;
            user: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                      token: {
                        type: string;
                        description: string;
                      };
                      url: {
                        type: string;
                        nullable: boolean;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      redirect: boolean;
      token: string;
      url?: string | undefined;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly resetPassword: better_call693.StrictEndpoint<"/reset-password", {
      method: "POST";
      operationId: string;
      query: z.ZodOptional<z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      body: z.ZodObject<{
        newPassword: z.ZodString;
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly verifyEmail: better_call693.StrictEndpoint<"/verify-email", {
      method: "GET";
      operationId: string;
      query: z.ZodObject<{
        token: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          parameters: ({
            name: string;
            in: "query";
            description: string;
            required: true;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, void | {
      status: boolean;
    }>;
    readonly sendVerificationEmail: better_call693.StrictEndpoint<"/send-verification-email", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodEmail;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    email: {
                      type: string;
                      description: string;
                      example: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                      example: string;
                      nullable: boolean;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                        example: boolean;
                      };
                    };
                  };
                };
              };
            };
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                        description: string;
                        example: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly changeEmail: better_call693.StrictEndpoint<"/change-email", {
      method: "POST";
      body: z.ZodObject<{
        newEmail: z.ZodEmail;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                        nullable: boolean;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly changePassword: better_call693.StrictEndpoint<"/change-password", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        newPassword: z.ZodString;
        currentPassword: z.ZodString;
        revokeOtherSessions: z.ZodOptional<z.ZodBoolean>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
                            type: string;
                            description: string;
                          };
                          createdAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          updatedAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                        };
                        required: string[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      token: string | null;
      user: {
        id: string;
        email: string;
        name: string;
        image: string | null | undefined;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    readonly setPassword: better_call693.StrictEndpoint<"/set-password", {
      method: "POST";
      body: z.ZodObject<{
        newPassword: z.ZodString;
      }, zod_v4_core0.$strip>;
      metadata: {
        SERVER_ONLY: true;
      };
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly updateUser: better_call693.StrictEndpoint<"/update-user", {
      method: "POST";
      operationId: string;
      body: z.ZodRecord<z.ZodString, z.ZodAny>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        $Infer: {
          body: Partial<AdditionalUserFieldsInput<Option>> & {
            name?: string | undefined;
            image?: string | undefined;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                  };
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly deleteUser: better_call693.StrictEndpoint<"/delete-user", {
      method: "POST";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    token: {
                      type: string;
                      description: string;
                    };
                  };
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
      message: string;
    }>;
    readonly requestPasswordReset: better_call693.StrictEndpoint<"/request-password-reset", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodEmail;
        redirectTo: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
      message: string;
    }>;
    readonly requestPasswordResetCallback: better_call693.StrictEndpoint<"/reset-password/:token", {
      method: "GET";
      operationId: string;
      query: z.ZodObject<{
        callbackURL: z.ZodString;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          parameters: ({
            name: string;
            in: "path";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, never>;
    readonly listSessions: better_call693.StrictEndpoint<"/list-sessions", {
      method: "GET";
      operationId: string;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    items: {
                      $ref: string;
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, Prettify$1<UnionToIntersection<StripEmptyObjects<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    } & (Option extends BetterAuthOptions ? AdditionalSessionFieldsOutput<Option> : Option extends Auth ? AdditionalSessionFieldsOutput<Option["options"]> : {})>>>[]>;
    readonly revokeSession: better_call693.StrictEndpoint<"/revoke-session", {
      method: "POST";
      body: z.ZodObject<{
        token: z.ZodString;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    token: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly revokeSessions: better_call693.StrictEndpoint<"/revoke-sessions", {
      method: "POST";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly revokeOtherSessions: better_call693.StrictEndpoint<"/revoke-other-sessions", {
      method: "POST";
      requireHeaders: true;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly linkSocialAccount: better_call693.StrictEndpoint<"/link-social", {
      method: "POST";
      requireHeaders: true;
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        idToken: z.ZodOptional<z.ZodObject<{
          token: z.ZodString;
          nonce: z.ZodOptional<z.ZodString>;
          accessToken: z.ZodOptional<z.ZodString>;
          refreshToken: z.ZodOptional<z.ZodString>;
          scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, zod_v4_core0.$strip>>;
        requestSignUp: z.ZodOptional<z.ZodBoolean>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        disableRedirect: z.ZodOptional<z.ZodBoolean>;
        additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      url: {
                        type: string;
                        description: string;
                      };
                      redirect: {
                        type: string;
                        description: string;
                      };
                      status: {
                        type: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      url: string;
      redirect: boolean;
    }>;
    readonly listUserAccounts: better_call693.StrictEndpoint<"/list-accounts", {
      method: "GET";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    items: {
                      type: string;
                      properties: {
                        id: {
                          type: string;
                        };
                        providerId: {
                          type: string;
                        };
                        createdAt: {
                          type: string;
                          format: string;
                        };
                        updatedAt: {
                          type: string;
                          format: string;
                        };
                        accountId: {
                          type: string;
                        };
                        userId: {
                          type: string;
                        };
                        scopes: {
                          type: string;
                          items: {
                            type: string;
                          };
                        };
                      };
                      required: string[];
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      id: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
      accountId: string;
      userId: string;
      scopes: string[];
    }[]>;
    readonly deleteUserCallback: better_call693.StrictEndpoint<"/delete-user/callback", {
      method: "GET";
      query: z.ZodObject<{
        token: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
      message: string;
    }>;
    readonly unlinkAccount: better_call693.StrictEndpoint<"/unlink-account", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly refreshToken: better_call693.StrictEndpoint<"/refresh-token", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string | undefined;
      refreshToken: string | undefined;
      accessTokenExpiresAt: Date | undefined;
      refreshTokenExpiresAt: Date | undefined;
      scope: string | null | undefined;
      idToken: string | null | undefined;
      providerId: string;
      accountId: string;
    }>;
    readonly getAccessToken: better_call693.StrictEndpoint<"/get-access-token", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string;
      accessTokenExpiresAt: Date | undefined;
      scopes: string[];
      idToken: string | undefined;
    }>;
    readonly accountInfo: better_call693.StrictEndpoint<"/account-info", {
      method: "GET";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                          };
                          name: {
                            type: string;
                          };
                          email: {
                            type: string;
                          };
                          image: {
                            type: string;
                          };
                          emailVerified: {
                            type: string;
                          };
                        };
                        required: string[];
                      };
                      data: {
                        type: string;
                        properties: {};
                        additionalProperties: boolean;
                      };
                    };
                    required: string[];
                    additionalProperties: boolean;
                  };
                };
              };
            };
          };
        };
      };
      query: z.ZodOptional<z.ZodObject<{
        accountId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
    } & {
      use: any[];
    }, {
      user: _better_auth_core_oauth28.OAuth2UserInfo;
      data: Record<string, any>;
    } | null>;
  } & UnionToIntersection<Option["plugins"] extends (infer T)[] ? T extends BetterAuthPlugin ? T extends {
    endpoints: infer E;
  } ? E : {} : {} : {}>;
  middlewares: {
    path: string;
    middleware: any;
  }[];
};
declare const router: <Option extends BetterAuthOptions>(ctx: AuthContext, options: Option) => {
  handler: (request: Request) => Promise<Response>;
  endpoints: {
    readonly ok: better_call693.StrictEndpoint<"/ok", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      ok: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, {
      ok: boolean;
    }>;
    readonly error: better_call693.StrictEndpoint<"/error", {
      method: "GET";
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "text/html": {
                  schema: {
                    type: "string";
                    description: string;
                  };
                };
              };
            };
          };
        };
        isAction: false;
      };
    } & {
      use: any[];
    }, Response>;
    readonly signInSocial: better_call693.StrictEndpoint<"/sign-in/social", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        newUserCallbackURL: z.ZodOptional<z.ZodString>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        disableRedirect: z.ZodOptional<z.ZodBoolean>;
        idToken: z.ZodOptional<z.ZodObject<{
          token: z.ZodString;
          nonce: z.ZodOptional<z.ZodString>;
          accessToken: z.ZodOptional<z.ZodString>;
          refreshToken: z.ZodOptional<z.ZodString>;
          expiresAt: z.ZodOptional<z.ZodNumber>;
        }, zod_v4_core0.$strip>>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        requestSignUp: z.ZodOptional<z.ZodBoolean>;
        loginHint: z.ZodOptional<z.ZodString>;
        additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        $Infer: {
          body: z.infer<z.ZodObject<{
            callbackURL: z.ZodOptional<z.ZodString>;
            newUserCallbackURL: z.ZodOptional<z.ZodString>;
            errorCallbackURL: z.ZodOptional<z.ZodString>;
            provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
            disableRedirect: z.ZodOptional<z.ZodBoolean>;
            idToken: z.ZodOptional<z.ZodObject<{
              token: z.ZodString;
              nonce: z.ZodOptional<z.ZodString>;
              accessToken: z.ZodOptional<z.ZodString>;
              refreshToken: z.ZodOptional<z.ZodString>;
              expiresAt: z.ZodOptional<z.ZodNumber>;
            }, zod_v4_core0.$strip>>;
            scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
            requestSignUp: z.ZodOptional<z.ZodBoolean>;
            loginHint: z.ZodOptional<z.ZodString>;
            additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
          }, zod_v4_core0.$strip>>;
          returned: {
            redirect: boolean;
            token?: string | undefined;
            url?: string | undefined;
            user?: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>> | undefined;
          };
        };
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      token: {
                        type: string;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                      url: {
                        type: string;
                      };
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      redirect: boolean;
      url: string;
    } | {
      redirect: boolean;
      token: string;
      url: undefined;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly callbackOAuth: better_call693.StrictEndpoint<"/callback/:id", {
      method: ("GET" | "POST")[];
      operationId: string;
      body: z.ZodOptional<z.ZodObject<{
        code: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        error_description: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      query: z.ZodOptional<z.ZodObject<{
        code: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodString>;
        device_id: z.ZodOptional<z.ZodString>;
        error_description: z.ZodOptional<z.ZodString>;
        state: z.ZodOptional<z.ZodString>;
        user: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      metadata: {
        allowedMediaTypes: string[];
        isAction: false;
      };
    } & {
      use: any[];
    }, void>;
    readonly getSession: better_call693.StrictEndpoint<"/get-session", {
      method: "GET";
      operationId: string;
      query: z.ZodOptional<z.ZodObject<{
        disableCookieCache: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
        disableRefresh: z.ZodOptional<z.ZodCoercedBoolean<unknown>>;
      }, zod_v4_core0.$strip>>;
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      session: {
                        $ref: string;
                      };
                      user: {
                        $ref: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      session: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        expiresAt: Date;
        token: string;
        ipAddress?: string | null | undefined;
        userAgent?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalSessionFieldsOutput<Option> : Option extends Auth ? AdditionalSessionFieldsOutput<Option["options"]> : {})>>;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    } | null>;
    readonly signOut: better_call693.StrictEndpoint<"/sign-out", {
      method: "POST";
      operationId: string;
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
    }>;
    readonly signUpEmail: better_call693.StrictEndpoint<"/sign-up/email", {
      method: "POST";
      operationId: string;
      body: z.ZodRecord<z.ZodString, z.ZodAny>;
      metadata: {
        $Infer: {
          body: {
            name: string;
            email: string;
            password: string;
            image?: string | undefined;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          } & InferFieldsFromPlugins<Option, "user", "input"> & InferFieldsFromOptions<Option, "user", "input">;
          returned: {
            token: string | null;
            user: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    email: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    rememberMe: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
                            type: string;
                            description: string;
                          };
                          createdAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          updatedAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                        };
                        required: string[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      token: null;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    } | {
      token: string;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly signInEmail: better_call693.StrictEndpoint<"/sign-in/email", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodString;
        password: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
        rememberMe: z.ZodOptional<z.ZodDefault<z.ZodBoolean>>;
      }, zod_v4_core0.$strip>;
      metadata: {
        $Infer: {
          body: {
            email: string;
            password: string;
            callbackURL?: string | undefined;
            rememberMe?: boolean | undefined;
          };
          returned: {
            redirect: boolean;
            token: string;
            url?: string | undefined;
            user: UnionToIntersection<StripEmptyObjects<{
              id: string;
              createdAt: Date;
              updatedAt: Date;
              email: string;
              emailVerified: boolean;
              name: string;
              image?: string | null | undefined;
            } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    description: string;
                    properties: {
                      redirect: {
                        type: string;
                        enum: boolean[];
                      };
                      token: {
                        type: string;
                        description: string;
                      };
                      url: {
                        type: string;
                        nullable: boolean;
                      };
                      user: {
                        type: string;
                        $ref: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      redirect: boolean;
      token: string;
      url?: string | undefined;
      user: UnionToIntersection<StripEmptyObjects<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string;
        emailVerified: boolean;
        name: string;
        image?: string | null | undefined;
      } & (Option extends BetterAuthOptions ? AdditionalUserFieldsOutput<Option> : Option extends Auth ? AdditionalUserFieldsOutput<Option["options"]> : {})>>;
    }>;
    readonly resetPassword: better_call693.StrictEndpoint<"/reset-password", {
      method: "POST";
      operationId: string;
      query: z.ZodOptional<z.ZodObject<{
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
      body: z.ZodObject<{
        newPassword: z.ZodString;
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly verifyEmail: better_call693.StrictEndpoint<"/verify-email", {
      method: "GET";
      operationId: string;
      query: z.ZodObject<{
        token: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          parameters: ({
            name: string;
            in: "query";
            description: string;
            required: true;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            description: string;
            required: false;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, void | {
      status: boolean;
    }>;
    readonly sendVerificationEmail: better_call693.StrictEndpoint<"/send-verification-email", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodEmail;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    email: {
                      type: string;
                      description: string;
                      example: string;
                    };
                    callbackURL: {
                      type: string;
                      description: string;
                      example: string;
                      nullable: boolean;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                        example: boolean;
                      };
                    };
                  };
                };
              };
            };
            "400": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                        description: string;
                        example: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly changeEmail: better_call693.StrictEndpoint<"/change-email", {
      method: "POST";
      body: z.ZodObject<{
        newEmail: z.ZodEmail;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                      status: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                        nullable: boolean;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
            "422": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly changePassword: better_call693.StrictEndpoint<"/change-password", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        newPassword: z.ZodString;
        currentPassword: z.ZodString;
        revokeOtherSessions: z.ZodOptional<z.ZodBoolean>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                        nullable: boolean;
                        description: string;
                      };
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                            description: string;
                          };
                          email: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          name: {
                            type: string;
                            description: string;
                          };
                          image: {
                            type: string;
                            format: string;
                            nullable: boolean;
                            description: string;
                          };
                          emailVerified: {
                            type: string;
                            description: string;
                          };
                          createdAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                          updatedAt: {
                            type: string;
                            format: string;
                            description: string;
                          };
                        };
                        required: string[];
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      token: string | null;
      user: {
        id: string;
        email: string;
        name: string;
        image: string | null | undefined;
        emailVerified: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
    readonly setPassword: better_call693.StrictEndpoint<"/set-password", {
      method: "POST";
      body: z.ZodObject<{
        newPassword: z.ZodString;
      }, zod_v4_core0.$strip>;
      metadata: {
        SERVER_ONLY: true;
      };
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly updateUser: better_call693.StrictEndpoint<"/update-user", {
      method: "POST";
      operationId: string;
      body: z.ZodRecord<z.ZodString, z.ZodAny>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        $Infer: {
          body: Partial<AdditionalUserFieldsInput<Option>> & {
            name?: string | undefined;
            image?: string | undefined;
          };
        };
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    name: {
                      type: string;
                      description: string;
                    };
                    image: {
                      type: string;
                      description: string;
                    };
                  };
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        $ref: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly deleteUser: better_call693.StrictEndpoint<"/delete-user", {
      method: "POST";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        password: z.ZodOptional<z.ZodString>;
        token: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    callbackURL: {
                      type: string;
                      description: string;
                    };
                    password: {
                      type: string;
                      description: string;
                    };
                    token: {
                      type: string;
                      description: string;
                    };
                  };
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
      message: string;
    }>;
    readonly requestPasswordReset: better_call693.StrictEndpoint<"/request-password-reset", {
      method: "POST";
      operationId: string;
      body: z.ZodObject<{
        email: z.ZodEmail;
        redirectTo: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                      message: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
      message: string;
    }>;
    readonly requestPasswordResetCallback: better_call693.StrictEndpoint<"/reset-password/:token", {
      method: "GET";
      operationId: string;
      query: z.ZodObject<{
        callbackURL: z.ZodString;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          parameters: ({
            name: string;
            in: "path";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          } | {
            name: string;
            in: "query";
            required: true;
            description: string;
            schema: {
              type: "string";
            };
          })[];
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      token: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, never>;
    readonly listSessions: better_call693.StrictEndpoint<"/list-sessions", {
      method: "GET";
      operationId: string;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    items: {
                      $ref: string;
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, Prettify$1<UnionToIntersection<StripEmptyObjects<{
      id: string;
      createdAt: Date;
      updatedAt: Date;
      userId: string;
      expiresAt: Date;
      token: string;
      ipAddress?: string | null | undefined;
      userAgent?: string | null | undefined;
    } & (Option extends BetterAuthOptions ? AdditionalSessionFieldsOutput<Option> : Option extends Auth ? AdditionalSessionFieldsOutput<Option["options"]> : {})>>>[]>;
    readonly revokeSession: better_call693.StrictEndpoint<"/revoke-session", {
      method: "POST";
      body: z.ZodObject<{
        token: z.ZodString;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object";
                  properties: {
                    token: {
                      type: string;
                      description: string;
                    };
                  };
                  required: string[];
                };
              };
            };
          };
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly revokeSessions: better_call693.StrictEndpoint<"/revoke-sessions", {
      method: "POST";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      requireHeaders: true;
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly revokeOtherSessions: better_call693.StrictEndpoint<"/revoke-other-sessions", {
      method: "POST";
      requireHeaders: true;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly linkSocialAccount: better_call693.StrictEndpoint<"/link-social", {
      method: "POST";
      requireHeaders: true;
      body: z.ZodObject<{
        callbackURL: z.ZodOptional<z.ZodString>;
        provider: z.ZodType<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown, zod_v4_core0.$ZodTypeInternals<"github" | "apple" | "atlassian" | "cognito" | "discord" | "facebook" | "figma" | "microsoft" | "google" | "huggingface" | "slack" | "spotify" | "twitch" | "twitter" | "dropbox" | "kick" | "linear" | "linkedin" | "gitlab" | "tiktok" | "reddit" | "roblox" | "salesforce" | "vk" | "zoom" | "notion" | "kakao" | "naver" | "line" | "paybin" | "paypal" | "polar" | "vercel" | (string & {}), unknown>>;
        idToken: z.ZodOptional<z.ZodObject<{
          token: z.ZodString;
          nonce: z.ZodOptional<z.ZodString>;
          accessToken: z.ZodOptional<z.ZodString>;
          refreshToken: z.ZodOptional<z.ZodString>;
          scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, zod_v4_core0.$strip>>;
        requestSignUp: z.ZodOptional<z.ZodBoolean>;
        scopes: z.ZodOptional<z.ZodArray<z.ZodString>>;
        errorCallbackURL: z.ZodOptional<z.ZodString>;
        disableRedirect: z.ZodOptional<z.ZodBoolean>;
        additionalData: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          operationId: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      url: {
                        type: string;
                        description: string;
                      };
                      redirect: {
                        type: string;
                        description: string;
                      };
                      status: {
                        type: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      url: string;
      redirect: boolean;
    }>;
    readonly listUserAccounts: better_call693.StrictEndpoint<"/list-accounts", {
      method: "GET";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          operationId: string;
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "array";
                    items: {
                      type: string;
                      properties: {
                        id: {
                          type: string;
                        };
                        providerId: {
                          type: string;
                        };
                        createdAt: {
                          type: string;
                          format: string;
                        };
                        updatedAt: {
                          type: string;
                          format: string;
                        };
                        accountId: {
                          type: string;
                        };
                        userId: {
                          type: string;
                        };
                        scopes: {
                          type: string;
                          items: {
                            type: string;
                          };
                        };
                      };
                      required: string[];
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      id: string;
      providerId: string;
      createdAt: Date;
      updatedAt: Date;
      accountId: string;
      userId: string;
      scopes: string[];
    }[]>;
    readonly deleteUserCallback: better_call693.StrictEndpoint<"/delete-user/callback", {
      method: "GET";
      query: z.ZodObject<{
        token: z.ZodString;
        callbackURL: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<void>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      success: {
                        type: string;
                        description: string;
                      };
                      message: {
                        type: string;
                        enum: string[];
                        description: string;
                      };
                    };
                    required: string[];
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      success: boolean;
      message: string;
    }>;
    readonly unlinkAccount: better_call693.StrictEndpoint<"/unlink-account", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      status: {
                        type: string;
                      };
                    };
                  };
                };
              };
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      status: boolean;
    }>;
    readonly refreshToken: better_call693.StrictEndpoint<"/refresh-token", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string | undefined;
      refreshToken: string | undefined;
      accessTokenExpiresAt: Date | undefined;
      refreshTokenExpiresAt: Date | undefined;
      scope: string | null | undefined;
      idToken: string | null | undefined;
      providerId: string;
      accountId: string;
    }>;
    readonly getAccessToken: better_call693.StrictEndpoint<"/get-access-token", {
      method: "POST";
      body: z.ZodObject<{
        providerId: z.ZodString;
        accountId: z.ZodOptional<z.ZodString>;
        userId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>;
      metadata: {
        openapi: {
          description: string;
          responses: {
            200: {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      tokenType: {
                        type: string;
                      };
                      idToken: {
                        type: string;
                      };
                      accessToken: {
                        type: string;
                      };
                      refreshToken: {
                        type: string;
                      };
                      accessTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                      refreshTokenExpiresAt: {
                        type: string;
                        format: string;
                      };
                    };
                  };
                };
              };
            };
            400: {
              description: string;
            };
          };
        };
      };
    } & {
      use: any[];
    }, {
      accessToken: string;
      accessTokenExpiresAt: Date | undefined;
      scopes: string[];
      idToken: string | undefined;
    }>;
    readonly accountInfo: better_call693.StrictEndpoint<"/account-info", {
      method: "GET";
      use: ((inputContext: better_call693.MiddlewareInputContext<better_call693.MiddlewareOptions>) => Promise<{
        session: {
          session: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
          };
          user: Record<string, any> & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            email: string;
            emailVerified: boolean;
            name: string;
            image?: string | null | undefined;
          };
        };
      }>)[];
      metadata: {
        openapi: {
          description: string;
          responses: {
            "200": {
              description: string;
              content: {
                "application/json": {
                  schema: {
                    type: "object";
                    properties: {
                      user: {
                        type: string;
                        properties: {
                          id: {
                            type: string;
                          };
                          name: {
                            type: string;
                          };
                          email: {
                            type: string;
                          };
                          image: {
                            type: string;
                          };
                          emailVerified: {
                            type: string;
                          };
                        };
                        required: string[];
                      };
                      data: {
                        type: string;
                        properties: {};
                        additionalProperties: boolean;
                      };
                    };
                    required: string[];
                    additionalProperties: boolean;
                  };
                };
              };
            };
          };
        };
      };
      query: z.ZodOptional<z.ZodObject<{
        accountId: z.ZodOptional<z.ZodString>;
      }, zod_v4_core0.$strip>>;
    } & {
      use: any[];
    }, {
      user: _better_auth_core_oauth28.OAuth2UserInfo;
      data: Record<string, any>;
    } | null>;
  } & UnionToIntersection<Option["plugins"] extends (infer T)[] ? T extends BetterAuthPlugin ? T extends {
    endpoints: infer E;
  } ? E : {} : {} : {}>;
};
//#endregion
//#region src/types/models.d.ts
type AdditionalUserFieldsInput<Options extends BetterAuthOptions> = InferFieldsFromPlugins<Options, "user", "input"> & InferFieldsFromOptions<Options, "user", "input">;
type AdditionalUserFieldsOutput<Options extends BetterAuthOptions> = InferFieldsFromPlugins<Options, "user", "output"> & InferFieldsFromOptions<Options, "user", "output">;
type AdditionalSessionFieldsInput<Options extends BetterAuthOptions> = InferFieldsFromPlugins<Options, "session", "input"> & InferFieldsFromOptions<Options, "session", "input">;
type AdditionalSessionFieldsOutput<Options extends BetterAuthOptions> = InferFieldsFromPlugins<Options, "session", "output"> & InferFieldsFromOptions<Options, "session", "output">;
type InferUser<O extends BetterAuthOptions | Auth> = UnionToIntersection<StripEmptyObjects<User & (O extends BetterAuthOptions ? AdditionalUserFieldsOutput<O> : O extends Auth ? AdditionalUserFieldsOutput<O["options"]> : {})>>;
type InferSession<O extends BetterAuthOptions | Auth> = UnionToIntersection<StripEmptyObjects<Session & (O extends BetterAuthOptions ? AdditionalSessionFieldsOutput<O> : O extends Auth ? AdditionalSessionFieldsOutput<O["options"]> : {})>>;
type InferPluginTypes<O extends BetterAuthOptions> = O["plugins"] extends Array<infer P> ? UnionToIntersection<P extends BetterAuthPlugin ? P["$Infer"] extends Record<string, any> ? P["$Infer"] : {} : {}> : {};
//#endregion
//#region src/types/auth.d.ts
type Auth<Options extends BetterAuthOptions = BetterAuthOptions> = {
  handler: (request: Request) => Promise<Response>;
  api: InferAPI<ReturnType<typeof router<Options>>["endpoints"]>;
  options: Options;
  $ERROR_CODES: InferPluginErrorCodes<Options> & typeof BASE_ERROR_CODES;
  $context: Promise<AuthContext>;
  /**
   * Share types
   */
  $Infer: InferPluginTypes<Options> extends {
    Session: any;
  } ? InferPluginTypes<Options> : {
    Session: {
      session: PrettifyDeep<InferSession<Options>>;
      user: PrettifyDeep<InferUser<Options>>;
    };
  } & InferPluginTypes<Options>;
};
//#endregion
export { createEmailVerificationToken as $, getBaseAdapter as $n, AdapterSchemaCreation as $t, deleteUser as A, parseInputData as An, BroadcastMessage as At, getSessionFromCtx as B, convertFromDB as Bn, index_d_exports as Bt, createAuthEndpoint$1 as C, getWithHooks as Cn, OnlineManager as Ct, router as D, parseAccountInput as Dn, kFocusManager as Dt, optionsMiddleware as E, mergeSchema as En, FocusManager as Et, signOut as F, createInternalAdapter as Fn, StandardSchemaV1$1 as Ft, revokeSessions as G, InferFieldsFromPlugins as Gn, parseState as Gt, requestOnlySessionMiddleware as H, FieldAttributeToObject as Hn, generateId as Ht, signInEmail as I, getAuthTables as In, TelemetryEvent as It, requestPasswordReset as J, InferFieldsOutput as Jn, FilteredAPI as Jt, sensitiveSessionMiddleware as K, InferFieldsInput as Kn, betterAuth as Kt, signInSocial as L, getSchema as Ln, createTelemetry$1 as Lt, setPassword as M, parseSessionOutput as Mn, kBroadcastChannel as Mt, updateUser as N, parseUserInput as Nn, JSONWebKeySet$1 as Nt, changeEmail as O, parseAccountOutput as On, BroadcastChannel as Ot, signUpEmail as P, parseUserOutput as Pn, JWTPayload$1 as Pt, error as Q, getAdapter as Qn, AdapterInstance as Qt, freshSessionMiddleware as R, getMigrations as Rn, getCurrentAdapter$1 as Rt, checkEndpointConflicts as S, InferRoute as Sn, OnlineListener as St, getEndpoints as T, toZodSchema as Tn, FocusListener as Tt, revokeOtherSessions as U, InferAdditionalFieldsFromPluginOptions as Un, HIDE_METADATA as Ut, listSessions as V, convertToDB as Vn, capitalizeFirstLetter as Vt, revokeSession as W, InferFieldsFromOptions as Wn, generateState as Wt, resetPassword as X, PluginFieldAttribute as Xn, InferSessionAPI as Xt, requestPasswordResetCallback as Y, InferValueType as Yn, InferAPI as Yt, ok as Z, createFieldAttribute as Zn, Adapter as Zt, User$1 as _, InferSessionFromClient as _n, AuthClient as _t, BetterAuthRateLimitOptions as a, Where$1 as an, getAccessToken as at, AuthEndpoint as b, SessionQueryParams as bn, createSessionRefreshManager as bt, AdditionalSessionFieldsInput as c, BetterAuthClientPlugin$1 as cn, refreshToken as ct, AdditionalUserFieldsOutput as d, ClientStore as dn, originCheckMiddleware as dt, DBAdapter$1 as en, sendVerificationEmail as et, InferPluginTypes as f, InferActions as fn, getOAuthState as ft, Session$1 as g, InferPluginsFromClient as gn, Primitive as gt, RateLimit as h, InferErrorCodes as hn, InferPlugin as ht, BetterAuthPlugin$1 as i, TransactionAdapter as in, accountInfo as it, deleteUserCallback as j, parseSessionInput as jn, getGlobalBroadcastChannel as jt, changePassword as k, parseAdditionalUserInput as kn, BroadcastListener as kt, AdditionalSessionFieldsOutput as l, ClientAtomListener as ln, unlinkAccount as lt, InferUser as m, InferClientAPI as mn, InferAuth as mt, BetterAuthCookies$1 as n, DBAdapterSchemaCreation$1 as nn, verifyEmail as nt, Auth as o, AtomListener as on, linkSocialAccount as ot, InferSession as p, InferAdditionalFromClient as pn, getIp as pt, sessionMiddleware as q, InferFieldsInputClient as qn, FilterActions as qt, BetterAuthOptions$1 as r, DBTransactionAdapter$1 as rn, callbackOAuth as rt, Account as s, BetterAuthClientOptions$1 as sn, listUserAccounts as st, BetterAuthAdvancedOptions as t, DBAdapterInstance$1 as tn, sendVerificationEmailFn as tt, AdditionalUserFieldsInput as u, ClientOptions as un, originCheck as ut, Verification as v, InferUserFromClient as vn, createAuthClient as vt, createAuthMiddleware$1 as w, FieldAttributeToSchema as wn, kOnlineManager as wt, AuthMiddleware as x, Store$1 as xn, useAuthQuery as xt, APIError$1 as y, IsSignal as yn, SessionRefreshOptions as yt, getSession as z, matchType as zn, getTelemetryAuthConfig as zt };