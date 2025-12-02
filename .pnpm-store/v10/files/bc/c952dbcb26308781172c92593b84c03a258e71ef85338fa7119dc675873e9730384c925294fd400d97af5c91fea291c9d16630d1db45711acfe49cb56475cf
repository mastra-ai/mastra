"use strict";
import { z } from "zod";
import { looseObject } from "./utils.js";
export const authDiff = looseObject({
  added: z.array(z.string()),
  removed: z.array(z.string())
});
export const componentDefinitionDiff = looseObject({});
export const componentDiffType = z.discriminatedUnion("type", [
  looseObject({
    type: z.literal("create")
  }),
  looseObject({
    type: z.literal("modify")
  }),
  looseObject({
    type: z.literal("unmount")
  }),
  looseObject({
    type: z.literal("remount")
  })
]);
export const moduleDiff = looseObject({
  added: z.array(z.string()),
  removed: z.array(z.string())
});
export const udfConfigDiff = looseObject({
  previous_version: z.string(),
  next_version: z.string()
});
export const cronDiff = looseObject({
  added: z.array(z.string()),
  updated: z.array(z.string()),
  deleted: z.array(z.string())
});
const developerIndexConfig = z.intersection(
  z.discriminatedUnion("type", [
    looseObject({
      name: z.string(),
      type: z.literal("database"),
      fields: z.array(z.string())
    }),
    looseObject({
      name: z.string(),
      type: z.literal("search"),
      searchField: z.string(),
      filterFields: z.array(z.string())
    }),
    looseObject({
      name: z.string(),
      type: z.literal("vector"),
      dimensions: z.number(),
      vectorField: z.string(),
      filterFields: z.array(z.string())
    })
  ]),
  z.object({ staged: z.boolean().optional() })
);
export const indexDiff = looseObject({
  added_indexes: z.array(developerIndexConfig),
  removed_indexes: z.array(developerIndexConfig),
  enabled_indexes: z.array(developerIndexConfig).optional(),
  disabled_indexes: z.array(developerIndexConfig).optional()
});
export const schemaDiff = looseObject({
  previous_schema: z.nullable(z.string()),
  next_schema: z.nullable(z.string())
});
export const componentDiff = looseObject({
  diffType: componentDiffType,
  moduleDiff,
  udfConfigDiff: z.nullable(udfConfigDiff),
  cronDiff,
  indexDiff,
  schemaDiff: z.nullable(schemaDiff)
});
export const finishPushDiff = looseObject({
  authDiff,
  definitionDiffs: z.record(z.string(), componentDefinitionDiff),
  componentDiffs: z.record(z.string(), componentDiff)
});
//# sourceMappingURL=finishPush.js.map
