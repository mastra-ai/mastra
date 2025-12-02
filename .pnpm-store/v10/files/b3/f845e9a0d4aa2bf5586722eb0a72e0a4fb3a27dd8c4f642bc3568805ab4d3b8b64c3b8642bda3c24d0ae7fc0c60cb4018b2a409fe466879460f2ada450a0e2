import { z } from "zod";
import { looseObject } from "./utils.js";

export const authDiff = looseObject({
  added: z.array(z.string()),
  removed: z.array(z.string()),
});
export type AuthDiff = z.infer<typeof authDiff>;

export const componentDefinitionDiff = looseObject({});
export type ComponentDefinitionDiff = z.infer<typeof componentDefinitionDiff>;

export const componentDiffType = z.discriminatedUnion("type", [
  looseObject({
    type: z.literal("create"),
  }),
  looseObject({
    type: z.literal("modify"),
  }),
  looseObject({
    type: z.literal("unmount"),
  }),
  looseObject({
    type: z.literal("remount"),
  }),
]);
export type ComponentDiffType = z.infer<typeof componentDiffType>;

export const moduleDiff = looseObject({
  added: z.array(z.string()),
  removed: z.array(z.string()),
});
export type ModuleDiff = z.infer<typeof moduleDiff>;

export const udfConfigDiff = looseObject({
  previous_version: z.string(),
  next_version: z.string(),
});
export type UdfConfigDiff = z.infer<typeof udfConfigDiff>;

export const cronDiff = looseObject({
  added: z.array(z.string()),
  updated: z.array(z.string()),
  deleted: z.array(z.string()),
});
export type CronDiff = z.infer<typeof cronDiff>;

const developerIndexConfig = z.intersection(
  z.discriminatedUnion("type", [
    looseObject({
      name: z.string(),
      type: z.literal("database"),
      fields: z.array(z.string()),
    }),
    looseObject({
      name: z.string(),
      type: z.literal("search"),
      searchField: z.string(),
      filterFields: z.array(z.string()),
    }),
    looseObject({
      name: z.string(),
      type: z.literal("vector"),
      dimensions: z.number(),
      vectorField: z.string(),
      filterFields: z.array(z.string()),
    }),
  ]),
  z.object({ staged: z.boolean().optional() }),
);
export type DeveloperIndexConfig = z.infer<typeof developerIndexConfig>;

export const indexDiff = looseObject({
  added_indexes: z.array(developerIndexConfig),
  removed_indexes: z.array(developerIndexConfig),
  enabled_indexes: z.array(developerIndexConfig).optional(),
  disabled_indexes: z.array(developerIndexConfig).optional(),
});
export type IndexDiff = z.infer<typeof indexDiff>;

export const schemaDiff = looseObject({
  previous_schema: z.nullable(z.string()),
  next_schema: z.nullable(z.string()),
});
export type SchemaDiff = z.infer<typeof schemaDiff>;

export const componentDiff = looseObject({
  diffType: componentDiffType,
  moduleDiff,
  udfConfigDiff: z.nullable(udfConfigDiff),
  cronDiff,
  indexDiff,
  schemaDiff: z.nullable(schemaDiff),
});
export type ComponentDiff = z.infer<typeof componentDiff>;

export const finishPushDiff = looseObject({
  authDiff,
  definitionDiffs: z.record(z.string(), componentDefinitionDiff),
  componentDiffs: z.record(z.string(), componentDiff),
});
export type FinishPushDiff = z.infer<typeof finishPushDiff>;
