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
var finishPush_exports = {};
__export(finishPush_exports, {
  authDiff: () => authDiff,
  componentDefinitionDiff: () => componentDefinitionDiff,
  componentDiff: () => componentDiff,
  componentDiffType: () => componentDiffType,
  cronDiff: () => cronDiff,
  finishPushDiff: () => finishPushDiff,
  indexDiff: () => indexDiff,
  moduleDiff: () => moduleDiff,
  schemaDiff: () => schemaDiff,
  udfConfigDiff: () => udfConfigDiff
});
module.exports = __toCommonJS(finishPush_exports);
var import_zod = require("zod");
var import_utils = require("./utils.js");
const authDiff = (0, import_utils.looseObject)({
  added: import_zod.z.array(import_zod.z.string()),
  removed: import_zod.z.array(import_zod.z.string())
});
const componentDefinitionDiff = (0, import_utils.looseObject)({});
const componentDiffType = import_zod.z.discriminatedUnion("type", [
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("create")
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("modify")
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("unmount")
  }),
  (0, import_utils.looseObject)({
    type: import_zod.z.literal("remount")
  })
]);
const moduleDiff = (0, import_utils.looseObject)({
  added: import_zod.z.array(import_zod.z.string()),
  removed: import_zod.z.array(import_zod.z.string())
});
const udfConfigDiff = (0, import_utils.looseObject)({
  previous_version: import_zod.z.string(),
  next_version: import_zod.z.string()
});
const cronDiff = (0, import_utils.looseObject)({
  added: import_zod.z.array(import_zod.z.string()),
  updated: import_zod.z.array(import_zod.z.string()),
  deleted: import_zod.z.array(import_zod.z.string())
});
const developerIndexConfig = import_zod.z.intersection(
  import_zod.z.discriminatedUnion("type", [
    (0, import_utils.looseObject)({
      name: import_zod.z.string(),
      type: import_zod.z.literal("database"),
      fields: import_zod.z.array(import_zod.z.string())
    }),
    (0, import_utils.looseObject)({
      name: import_zod.z.string(),
      type: import_zod.z.literal("search"),
      searchField: import_zod.z.string(),
      filterFields: import_zod.z.array(import_zod.z.string())
    }),
    (0, import_utils.looseObject)({
      name: import_zod.z.string(),
      type: import_zod.z.literal("vector"),
      dimensions: import_zod.z.number(),
      vectorField: import_zod.z.string(),
      filterFields: import_zod.z.array(import_zod.z.string())
    })
  ]),
  import_zod.z.object({ staged: import_zod.z.boolean().optional() })
);
const indexDiff = (0, import_utils.looseObject)({
  added_indexes: import_zod.z.array(developerIndexConfig),
  removed_indexes: import_zod.z.array(developerIndexConfig),
  enabled_indexes: import_zod.z.array(developerIndexConfig).optional(),
  disabled_indexes: import_zod.z.array(developerIndexConfig).optional()
});
const schemaDiff = (0, import_utils.looseObject)({
  previous_schema: import_zod.z.nullable(import_zod.z.string()),
  next_schema: import_zod.z.nullable(import_zod.z.string())
});
const componentDiff = (0, import_utils.looseObject)({
  diffType: componentDiffType,
  moduleDiff,
  udfConfigDiff: import_zod.z.nullable(udfConfigDiff),
  cronDiff,
  indexDiff,
  schemaDiff: import_zod.z.nullable(schemaDiff)
});
const finishPushDiff = (0, import_utils.looseObject)({
  authDiff,
  definitionDiffs: import_zod.z.record(import_zod.z.string(), componentDefinitionDiff),
  componentDiffs: import_zod.z.record(import_zod.z.string(), componentDiff)
});
//# sourceMappingURL=finishPush.js.map
