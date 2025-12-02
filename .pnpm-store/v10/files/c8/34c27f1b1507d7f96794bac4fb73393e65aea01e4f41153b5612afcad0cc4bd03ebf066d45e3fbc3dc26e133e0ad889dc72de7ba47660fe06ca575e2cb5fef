"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var modules_exports = {};
__export(modules_exports, {
  analyzedFunction: () => analyzedFunction,
  analyzedModule: () => analyzedModule,
  moduleConfig: () => moduleConfig,
  moduleEnvironment: () => moduleEnvironment,
  nodeDependency: () => nodeDependency,
  sourcePackage: () => sourcePackage,
  udfConfig: () => udfConfig,
  visibility: () => visibility
});
module.exports = __toCommonJS(modules_exports);
var import_zod = require("zod");
var import_utils = require("./utils.js");
const moduleEnvironment = import_zod.z.union([
  import_zod.z.literal("isolate"),
  import_zod.z.literal("node")
]);
const moduleConfig = (0, import_utils.looseObject)({
  path: import_zod.z.string(),
  source: import_zod.z.string(),
  sourceMap: import_zod.z.optional(import_zod.z.string()),
  environment: moduleEnvironment
});
const nodeDependency = (0, import_utils.looseObject)({
  name: import_zod.z.string(),
  version: import_zod.z.string()
});
const udfConfig = (0, import_utils.looseObject)({
  serverVersion: import_zod.z.string(),
  // RNG seed encoded as Convex bytes in JSON.
  importPhaseRngSeed: import_zod.z.any(),
  // Timestamp encoded as a Convex Int64 in JSON.
  importPhaseUnixTimestamp: import_zod.z.any()
});
const sourcePackage = import_zod.z.any();
const visibility = import_zod.z.union([
  (0, import_utils.looseObject)({ kind: import_zod.z.literal("public") }),
  (0, import_utils.looseObject)({ kind: import_zod.z.literal("internal") })
]);
const analyzedFunction = (0, import_utils.looseObject)({
  name: import_zod.z.string(),
  pos: import_zod.z.any(),
  udfType: import_zod.z.union([
    import_zod.z.literal("Query"),
    import_zod.z.literal("Mutation"),
    import_zod.z.literal("Action")
  ]),
  visibility: import_zod.z.nullable(visibility),
  args: import_zod.z.nullable(import_zod.z.string()),
  returns: import_zod.z.nullable(import_zod.z.string())
});
const analyzedModule = (0, import_utils.looseObject)({
  functions: import_zod.z.array(analyzedFunction),
  httpRoutes: import_zod.z.any(),
  cronSpecs: import_zod.z.any(),
  sourceMapped: import_zod.z.any()
});
//# sourceMappingURL=modules.js.map
