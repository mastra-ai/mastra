import { z } from "zod";
import { componentDefinitionPath, componentPath } from "./paths.js";
import { nodeDependency, sourcePackage } from "./modules.js";
import { checkedComponent } from "./checkedComponent.js";
import { evaluatedComponentDefinition } from "./componentDefinition.js";
import {
  appDefinitionConfig,
  componentDefinitionConfig,
} from "./definitionConfig.js";
import { authInfo } from "./types.js";
import { looseObject } from "./utils.js";
import { indexDiff } from "./finishPush.js";

export const startPushRequest = looseObject({
  adminKey: z.string(),
  dryRun: z.boolean(),

  functions: z.string(),

  appDefinition: appDefinitionConfig,
  componentDefinitions: z.array(componentDefinitionConfig),

  nodeDependencies: z.array(nodeDependency),

  nodeVersion: z.optional(z.string()),
});
export type StartPushRequest = z.infer<typeof startPushRequest>;

export const schemaChange = looseObject({
  allocatedComponentIds: z.any(),
  schemaIds: z.any(),
  indexDiffs: z.record(componentDefinitionPath, indexDiff).optional(),
});
export type SchemaChange = z.infer<typeof schemaChange>;

export const startPushResponse = looseObject({
  environmentVariables: z.record(z.string(), z.string()),

  externalDepsId: z.nullable(z.string()),
  componentDefinitionPackages: z.record(componentDefinitionPath, sourcePackage),

  appAuth: z.array(authInfo),
  analysis: z.record(componentDefinitionPath, evaluatedComponentDefinition),

  app: checkedComponent,

  schemaChange,
});
export type StartPushResponse = z.infer<typeof startPushResponse>;

export const evaluatePushResponse = looseObject({
  schemaChange,
});
export type EvaluatePushResponse = z.infer<typeof evaluatePushResponse>;

export const componentSchemaStatus = looseObject({
  schemaValidationComplete: z.boolean(),
  indexesComplete: z.number(),
  indexesTotal: z.number(),
});
export type ComponentSchemaStatus = z.infer<typeof componentSchemaStatus>;

export const schemaStatus = z.union([
  looseObject({
    type: z.literal("inProgress"),
    components: z.record(componentPath, componentSchemaStatus),
  }),
  looseObject({
    type: z.literal("failed"),
    error: z.string(),
    componentPath,
    tableName: z.nullable(z.string()),
  }),
  looseObject({
    type: z.literal("raceDetected"),
  }),
  looseObject({
    type: z.literal("complete"),
  }),
]);
export type SchemaStatus = z.infer<typeof schemaStatus>;
