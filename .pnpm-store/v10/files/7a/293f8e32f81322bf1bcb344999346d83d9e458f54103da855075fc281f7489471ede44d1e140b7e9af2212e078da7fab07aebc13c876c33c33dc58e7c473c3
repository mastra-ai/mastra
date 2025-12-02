import { h as UnionToIntersection } from "./helper-DU33OcfW.mjs";
import { BetterAuthOptions, BetterAuthPlugin } from "@better-auth/core";
import { BetterAuthPluginDBSchema } from "@better-auth/core/db";

//#region src/types/plugins.d.ts
type InferOptionSchema<S extends BetterAuthPluginDBSchema> = S extends Record<string, {
  fields: infer Fields;
}> ? { [K in keyof S]?: {
  modelName?: string | undefined;
  fields?: { [P in keyof Fields]?: string } | undefined;
} } : never;
type InferPluginErrorCodes<O extends BetterAuthOptions> = O["plugins"] extends Array<infer P> ? UnionToIntersection<P extends BetterAuthPlugin ? P["$ERROR_CODES"] extends Record<string, any> ? P["$ERROR_CODES"] : {} : {}> : {};
//#endregion
export { InferPluginErrorCodes as n, InferOptionSchema as t };