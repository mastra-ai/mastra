"use strict";
import { z } from "zod";
import { looseObject } from "./utils.js";
export const moduleEnvironment = z.union([
  z.literal("isolate"),
  z.literal("node")
]);
export const moduleConfig = looseObject({
  path: z.string(),
  source: z.string(),
  sourceMap: z.optional(z.string()),
  environment: moduleEnvironment
});
export const nodeDependency = looseObject({
  name: z.string(),
  version: z.string()
});
export const udfConfig = looseObject({
  serverVersion: z.string(),
  // RNG seed encoded as Convex bytes in JSON.
  importPhaseRngSeed: z.any(),
  // Timestamp encoded as a Convex Int64 in JSON.
  importPhaseUnixTimestamp: z.any()
});
export const sourcePackage = z.any();
export const visibility = z.union([
  looseObject({ kind: z.literal("public") }),
  looseObject({ kind: z.literal("internal") })
]);
export const analyzedFunction = looseObject({
  name: z.string(),
  pos: z.any(),
  udfType: z.union([
    z.literal("Query"),
    z.literal("Mutation"),
    z.literal("Action")
  ]),
  visibility: z.nullable(visibility),
  args: z.nullable(z.string()),
  returns: z.nullable(z.string())
});
export const analyzedModule = looseObject({
  functions: z.array(analyzedFunction),
  httpRoutes: z.any(),
  cronSpecs: z.any(),
  sourceMapped: z.any()
});
//# sourceMappingURL=modules.js.map
