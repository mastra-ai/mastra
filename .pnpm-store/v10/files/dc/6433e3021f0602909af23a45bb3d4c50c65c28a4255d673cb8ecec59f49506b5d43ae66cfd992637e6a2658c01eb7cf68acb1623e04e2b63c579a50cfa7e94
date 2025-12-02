"use strict";
import { z } from "zod";
import { canonicalizedModulePath, componentDefinitionPath } from "./paths.js";
import { identifier, reference } from "./types.js";
import { analyzedModule, udfConfig } from "./modules.js";
import { looseObject } from "./utils.js";
import { convexValidator } from "./validator.js";
export const componentArgumentValidator = looseObject({
  type: z.literal("value"),
  // Validator serialized to JSON.
  value: z.string()
});
export const componentDefinitionType = z.union([
  looseObject({ type: z.literal("app") }),
  looseObject({
    type: z.literal("childComponent"),
    name: identifier,
    args: z.array(z.tuple([identifier, componentArgumentValidator]))
  })
]);
export const componentArgument = looseObject({
  type: z.literal("value"),
  // Value serialized to JSON.
  value: z.string()
});
export const componentInstantiation = looseObject({
  name: identifier,
  path: componentDefinitionPath,
  args: z.nullable(z.array(z.tuple([identifier, componentArgument])))
});
export const componentExports = z.lazy(
  () => z.union([
    looseObject({
      type: z.literal("leaf"),
      leaf: reference
    }),
    looseObject({
      type: z.literal("branch"),
      branch: z.array(z.tuple([identifier, componentExports]))
    })
  ])
);
export const componentDefinitionMetadata = looseObject({
  path: componentDefinitionPath,
  definitionType: componentDefinitionType,
  childComponents: z.array(componentInstantiation),
  httpMounts: z.record(z.string(), reference),
  exports: looseObject({
    type: z.literal("branch"),
    branch: z.array(z.tuple([identifier, componentExports]))
  })
});
export const indexSchema = looseObject({
  indexDescriptor: z.string(),
  fields: z.array(z.string())
});
export const vectorIndexSchema = looseObject({
  indexDescriptor: z.string(),
  vectorField: z.string(),
  dimensions: z.number().optional(),
  filterFields: z.array(z.string())
});
export const searchIndexSchema = looseObject({
  indexDescriptor: z.string(),
  searchField: z.string(),
  filterFields: z.array(z.string())
});
export const tableDefinition = looseObject({
  tableName: z.string(),
  indexes: z.array(indexSchema),
  searchIndexes: z.array(searchIndexSchema).optional().nullable(),
  vectorIndexes: z.array(vectorIndexSchema).optional().nullable(),
  documentType: convexValidator
});
export const analyzedSchema = looseObject({
  tables: z.array(tableDefinition),
  schemaValidation: z.boolean()
});
export const evaluatedComponentDefinition = looseObject({
  definition: componentDefinitionMetadata,
  schema: analyzedSchema.optional().nullable(),
  functions: z.record(canonicalizedModulePath, analyzedModule),
  udfConfig
});
//# sourceMappingURL=componentDefinition.js.map
