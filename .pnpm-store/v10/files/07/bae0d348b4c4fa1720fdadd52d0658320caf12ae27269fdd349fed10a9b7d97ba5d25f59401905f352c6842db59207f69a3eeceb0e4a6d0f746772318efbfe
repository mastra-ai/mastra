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
var componentDefinition_exports = {};
__export(componentDefinition_exports, {
  analyzedSchema: () => analyzedSchema,
  componentArgument: () => componentArgument,
  componentArgumentValidator: () => componentArgumentValidator,
  componentDefinitionMetadata: () => componentDefinitionMetadata,
  componentDefinitionType: () => componentDefinitionType,
  componentExports: () => componentExports,
  componentInstantiation: () => componentInstantiation,
  evaluatedComponentDefinition: () => evaluatedComponentDefinition,
  indexSchema: () => indexSchema,
  searchIndexSchema: () => searchIndexSchema,
  tableDefinition: () => tableDefinition,
  vectorIndexSchema: () => vectorIndexSchema
});
module.exports = __toCommonJS(componentDefinition_exports);
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_types = require("./types.js");
var import_modules = require("./modules.js");
var import_utils = require("./utils.js");
var import_validator = require("./validator.js");
const componentArgumentValidator = (0, import_utils.looseObject)({
  type: import_zod.z.literal("value"),
  // Validator serialized to JSON.
  value: import_zod.z.string()
});
const componentDefinitionType = import_zod.z.union([
  (0, import_utils.looseObject)({ type: import_zod.z.literal("app") }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("childComponent"),
    name: import_types.identifier,
    args: import_zod.z.array(import_zod.z.tuple([import_types.identifier, componentArgumentValidator]))
  })
]);
const componentArgument = (0, import_utils.looseObject)({
  type: import_zod.z.literal("value"),
  // Value serialized to JSON.
  value: import_zod.z.string()
});
const componentInstantiation = (0, import_utils.looseObject)({
  name: import_types.identifier,
  path: import_paths.componentDefinitionPath,
  args: import_zod.z.nullable(import_zod.z.array(import_zod.z.tuple([import_types.identifier, componentArgument])))
});
const componentExports = import_zod.z.lazy(
  () => import_zod.z.union([
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("leaf"),
      leaf: import_types.reference
    }),
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("branch"),
      branch: import_zod.z.array(import_zod.z.tuple([import_types.identifier, componentExports]))
    })
  ])
);
const componentDefinitionMetadata = (0, import_utils.looseObject)({
  path: import_paths.componentDefinitionPath,
  definitionType: componentDefinitionType,
  childComponents: import_zod.z.array(componentInstantiation),
  httpMounts: import_zod.z.record(import_zod.z.string(), import_types.reference),
  exports: (0, import_utils.looseObject)({
    type: import_zod.z.literal("branch"),
    branch: import_zod.z.array(import_zod.z.tuple([import_types.identifier, componentExports]))
  })
});
const indexSchema = (0, import_utils.looseObject)({
  indexDescriptor: import_zod.z.string(),
  fields: import_zod.z.array(import_zod.z.string())
});
const vectorIndexSchema = (0, import_utils.looseObject)({
  indexDescriptor: import_zod.z.string(),
  vectorField: import_zod.z.string(),
  dimensions: import_zod.z.number().optional(),
  filterFields: import_zod.z.array(import_zod.z.string())
});
const searchIndexSchema = (0, import_utils.looseObject)({
  indexDescriptor: import_zod.z.string(),
  searchField: import_zod.z.string(),
  filterFields: import_zod.z.array(import_zod.z.string())
});
const tableDefinition = (0, import_utils.looseObject)({
  tableName: import_zod.z.string(),
  indexes: import_zod.z.array(indexSchema),
  searchIndexes: import_zod.z.array(searchIndexSchema).optional().nullable(),
  vectorIndexes: import_zod.z.array(vectorIndexSchema).optional().nullable(),
  documentType: import_validator.convexValidator
});
const analyzedSchema = (0, import_utils.looseObject)({
  tables: import_zod.z.array(tableDefinition),
  schemaValidation: import_zod.z.boolean()
});
const evaluatedComponentDefinition = (0, import_utils.looseObject)({
  definition: componentDefinitionMetadata,
  schema: analyzedSchema.optional().nullable(),
  functions: import_zod.z.record(import_paths.canonicalizedModulePath, import_modules.analyzedModule),
  udfConfig: import_modules.udfConfig
});
//# sourceMappingURL=componentDefinition.js.map
