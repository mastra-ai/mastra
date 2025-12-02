import { $t as AdapterSchemaCreation, an as Where$1, in as TransactionAdapter } from "../index--CrC0_x3.mjs";
import "../types-CRiHq5rJ.mjs";
import { u as Prettify } from "../helper-DU33OcfW.mjs";
import "../index-CNCxG_Zo.mjs";
import "../plugins-Brc8BsoZ.mjs";
import { BetterAuthOptions } from "@better-auth/core";
import * as _better_auth_core_db23 from "@better-auth/core/db";
import { BetterAuthDBSchema, DBFieldAttribute } from "@better-auth/core/db";
import { CustomAdapter as CustomAdapter$1, DBAdapter, DBAdapterFactoryConfig, JoinConfig } from "@better-auth/core/db/adapter";
export * from "@better-auth/core/db/adapter";

//#region src/adapters/adapter-factory/get-default-field-name.d.ts
declare const initGetDefaultFieldName: ({
  schema,
  usePlural
}: {
  schema: BetterAuthDBSchema;
  usePlural: boolean | undefined;
}) => ({
  field,
  model: unsafeModel
}: {
  model: string;
  field: string;
}) => string;
//#endregion
//#region src/adapters/adapter-factory/get-default-model-name.d.ts
declare const initGetDefaultModelName: ({
  usePlural,
  schema
}: {
  usePlural: boolean | undefined;
  schema: BetterAuthDBSchema;
}) => (model: string) => string;
//#endregion
//#region src/adapters/adapter-factory/get-field-attributes.d.ts
declare const initGetFieldAttributes: ({
  usePlural,
  schema,
  options,
  customIdGenerator,
  disableIdGeneration
}: {
  usePlural?: boolean;
  schema: BetterAuthDBSchema;
  options: BetterAuthOptions;
  disableIdGeneration?: boolean;
  customIdGenerator?: ((props: {
    model: string;
  }) => string) | undefined;
}) => ({
  model,
  field
}: {
  model: string;
  field: string;
}) => _better_auth_core_db23.DBFieldAttribute<_better_auth_core_db23.DBFieldType>;
//#endregion
//#region src/adapters/adapter-factory/get-field-name.d.ts
declare const initGetFieldName: ({
  schema,
  usePlural
}: {
  schema: BetterAuthDBSchema;
  usePlural: boolean | undefined;
}) => ({
  model: modelName,
  field: fieldName
}: {
  model: string;
  field: string;
}) => string;
//#endregion
//#region src/adapters/adapter-factory/get-id-field.d.ts
declare const initGetIdField: ({
  usePlural,
  schema,
  disableIdGeneration,
  options,
  customIdGenerator,
  supportsUUIDs
}: {
  usePlural?: boolean;
  schema: BetterAuthDBSchema;
  options: BetterAuthOptions;
  disableIdGeneration?: boolean;
  customIdGenerator?: ((props: {
    model: string;
  }) => string) | undefined;
  supportsUUIDs?: boolean;
}) => ({
  customModelName,
  forceAllowId
}: {
  customModelName?: string;
  forceAllowId?: boolean;
}) => {
  transform: {
    input: (value: _better_auth_core_db23.DBPrimitive) => string | number | true | Date | unknown[] | Record<string, unknown> | undefined;
    output: (value: _better_auth_core_db23.DBPrimitive) => string | undefined;
  };
  defaultValue?: (() => string | false | undefined) | undefined;
  type: "string" | "number";
  required: boolean;
};
//#endregion
//#region src/adapters/adapter-factory/get-model-name.d.ts
declare const initGetModelName: ({
  usePlural,
  schema
}: {
  usePlural: boolean | undefined;
  schema: BetterAuthDBSchema;
}) => (model: string) => string;
//#endregion
//#region src/adapters/adapter-factory/types.d.ts
type AdapterFactoryOptions = {
  config: AdapterFactoryConfig;
  adapter: AdapterFactoryCustomizeAdapterCreator;
};
interface AdapterFactoryConfig extends Omit<DBAdapterFactoryConfig<BetterAuthOptions>, "transaction"> {
  /**
   * Execute multiple operations in a transaction.
   *
   * If the database doesn't support transactions, set this to `false` and operations will be executed sequentially.
   *
   * @default false
   */
  transaction?: (false | (<R>(callback: (trx: TransactionAdapter) => Promise<R>) => Promise<R>)) | undefined;
}
type AdapterFactoryCustomizeAdapterCreator = (config: {
  options: BetterAuthOptions;
  /**
   * The schema of the user's Better-Auth instance.
   */
  schema: BetterAuthDBSchema;
  /**
   * The debug log function.
   *
   * If the config has defined `debugLogs` as `false`, no logs will be shown.
   */
  debugLog: (...args: any[]) => void;
  /**
   * Get the model name which is expected to be saved in the database based on the user's schema.
   */
  getModelName: (model: string) => string;
  /**
   * Get the field name which is expected to be saved in the database based on the user's schema.
   */
  getFieldName: ({
    model,
    field
  }: {
    model: string;
    field: string;
  }) => string;
  /**
   * This function helps us get the default model name from the schema defined by devs.
   * Often times, the user will be using the `modelName` which could had been customized by the users.
   * This function helps us get the actual model name useful to match against the schema. (eg: schema[model])
   *
   * If it's still unclear what this does:
   *
   * 1. User can define a custom modelName.
   * 2. When using a custom modelName, doing something like `schema[model]` will not work.
   * 3. Using this function helps us get the actual model name based on the user's defined custom modelName.
   * 4. Thus allowing us to use `schema[model]`.
   */
  getDefaultModelName: (model: string) => string;
  /**
   * This function helps us get the default field name from the schema defined by devs.
   * Often times, the user will be using the `fieldName` which could had been customized by the users.
   * This function helps us get the actual field name useful to match against the schema. (eg: schema[model].fields[field])
   *
   * If it's still unclear what this does:
   *
   * 1. User can define a custom fieldName.
   * 2. When using a custom fieldName, doing something like `schema[model].fields[field]` will not work.
   *
   */
  getDefaultFieldName: ({
    model,
    field
  }: {
    model: string;
    field: string;
  }) => string;
  /**
   * Get the field attributes for a given model and field.
   *
   * Note: any model name or field name is allowed, whether default to schema or not.
   */
  getFieldAttributes: ({
    model,
    field
  }: {
    model: string;
    field: string;
  }) => DBFieldAttribute;
  transformInput: (data: Record<string, any>, defaultModelName: string, action: "create" | "update", forceAllowId?: boolean | undefined) => Promise<Record<string, any>>;
  transformOutput: (data: Record<string, any>, defaultModelName: string, select?: string[] | undefined, joinConfig?: JoinConfig | undefined) => Promise<Record<string, any>>;
  transformWhereClause: <W extends Where$1[] | undefined>({
    model,
    where
  }: {
    where: W;
    model: string;
  }) => W extends undefined ? undefined : CleanedWhere[];
}) => CustomAdapter;
/**
 * @deprecated Use `CustomAdapter` from `@better-auth/core/db/adapter` instead.
 */
interface CustomAdapter extends Omit<CustomAdapter$1, "createSchema"> {
  createSchema?: ((props: {
    /**
     * The file the user may have passed in to the `generate` command as the expected schema file output path.
     */
    file?: string;
    /**
     * The tables from the user's Better-Auth instance schema.
     */
    tables: BetterAuthDBSchema;
  }) => Promise<AdapterSchemaCreation>) | undefined;
}
/**
 * @deprecated Use `CleanedWhere` from `@better-auth/core/db/adapter` instead.
 */
type CleanedWhere = Prettify<Required<Where$1>>;
type AdapterTestDebugLogs = {
  resetDebugLogs: () => void;
  printDebugLogs: () => void;
};
//#endregion
//#region src/adapters/adapter-factory/index.d.ts
type AdapterFactory = (options: BetterAuthOptions) => DBAdapter<BetterAuthOptions>;
declare const createAdapterFactory: ({
  adapter: customAdapter,
  config: cfg
}: AdapterFactoryOptions) => AdapterFactory;
//#endregion
//#region src/adapters/index.d.ts
/**
 * @deprecated Use `createAdapterFactory` instead. This export will be removed in the next major version.
 */
declare const createAdapter: ({
  adapter: customAdapter,
  config: cfg
}: AdapterFactoryOptions) => AdapterFactory;
/**
 * @deprecated Use `AdapterFactoryOptions` instead. This export will be removed in the next major version.
 */
type CreateAdapterOptions = AdapterFactoryOptions;
/**
 * @deprecated Use `AdapterFactoryConfig` instead. This export will be removed in the next major version.
 */
type AdapterConfig = AdapterFactoryConfig;
/**
 * @deprecated Use `AdapterFactoryCustomizeAdapterCreator` instead. This export will be removed in the next major version.
 */
type CreateCustomAdapter = AdapterFactoryCustomizeAdapterCreator;
//#endregion
export { AdapterConfig, type AdapterFactory, type AdapterFactoryConfig, type AdapterFactoryCustomizeAdapterCreator, type AdapterFactoryOptions, type AdapterTestDebugLogs, CreateAdapterOptions, CreateCustomAdapter, type CustomAdapter, createAdapter, createAdapterFactory, initGetDefaultFieldName, initGetDefaultModelName, initGetFieldAttributes, initGetFieldName, initGetIdField, initGetModelName };