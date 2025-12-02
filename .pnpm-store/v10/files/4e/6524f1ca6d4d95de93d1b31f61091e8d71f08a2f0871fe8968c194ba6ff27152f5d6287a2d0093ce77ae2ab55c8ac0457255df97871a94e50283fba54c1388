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
var startPush_exports = {};
__export(startPush_exports, {
  componentSchemaStatus: () => componentSchemaStatus,
  evaluatePushResponse: () => evaluatePushResponse,
  schemaChange: () => schemaChange,
  schemaStatus: () => schemaStatus,
  startPushRequest: () => startPushRequest,
  startPushResponse: () => startPushResponse
});
module.exports = __toCommonJS(startPush_exports);
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_modules = require("./modules.js");
var import_checkedComponent = require("./checkedComponent.js");
var import_componentDefinition = require("./componentDefinition.js");
var import_definitionConfig = require("./definitionConfig.js");
var import_types = require("./types.js");
var import_utils = require("./utils.js");
var import_finishPush = require("./finishPush.js");
const startPushRequest = (0, import_utils.looseObject)({
  adminKey: import_zod.z.string(),
  dryRun: import_zod.z.boolean(),
  functions: import_zod.z.string(),
  appDefinition: import_definitionConfig.appDefinitionConfig,
  componentDefinitions: import_zod.z.array(import_definitionConfig.componentDefinitionConfig),
  nodeDependencies: import_zod.z.array(import_modules.nodeDependency),
  nodeVersion: import_zod.z.optional(import_zod.z.string())
});
const schemaChange = (0, import_utils.looseObject)({
  allocatedComponentIds: import_zod.z.any(),
  schemaIds: import_zod.z.any(),
  indexDiffs: import_zod.z.record(import_paths.componentDefinitionPath, import_finishPush.indexDiff).optional()
});
const startPushResponse = (0, import_utils.looseObject)({
  environmentVariables: import_zod.z.record(import_zod.z.string(), import_zod.z.string()),
  externalDepsId: import_zod.z.nullable(import_zod.z.string()),
  componentDefinitionPackages: import_zod.z.record(import_paths.componentDefinitionPath, import_modules.sourcePackage),
  appAuth: import_zod.z.array(import_types.authInfo),
  analysis: import_zod.z.record(import_paths.componentDefinitionPath, import_componentDefinition.evaluatedComponentDefinition),
  app: import_checkedComponent.checkedComponent,
  schemaChange
});
const evaluatePushResponse = (0, import_utils.looseObject)({
  schemaChange
});
const componentSchemaStatus = (0, import_utils.looseObject)({
  schemaValidationComplete: import_zod.z.boolean(),
  indexesComplete: import_zod.z.number(),
  indexesTotal: import_zod.z.number()
});
const schemaStatus = import_zod.z.union([
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("inProgress"),
    components: import_zod.z.record(import_paths.componentPath, componentSchemaStatus)
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("failed"),
    error: import_zod.z.string(),
    componentPath: import_paths.componentPath,
    tableName: import_zod.z.nullable(import_zod.z.string())
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("raceDetected")
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("complete")
  })
]);
//# sourceMappingURL=startPush.js.map
