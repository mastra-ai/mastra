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
var validator_exports = {};
__export(validator_exports, {
  convexValidator: () => convexValidator
});
module.exports = __toCommonJS(validator_exports);
var import_zod = require("zod");
var import_utils = require("./utils.js");
const baseConvexValidator = import_zod.z.discriminatedUnion("type", [
  (0, import_utils.looseObject)({ type: import_zod.z.literal("null") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("number") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("bigint") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("boolean") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("string") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("bytes") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("any") }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("literal"), value: import_zod.z.any() }),
  (0, import_utils.looseObject)({ type: import_zod.z.literal("id"), tableName: import_zod.z.string() })
]);
const convexValidator = import_zod.z.lazy(
  () => import_zod.z.union([
    baseConvexValidator,
    (0, import_utils.looseObject)({ type: import_zod.z.literal("array"), value: convexValidator }),
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("record"),
      keys: convexValidator,
      values: import_zod.z.object({
        fieldType: convexValidator,
        optional: import_zod.z.literal(false)
      })
    }),
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("union"),
      value: import_zod.z.array(convexValidator)
    }),
    (0, import_utils.looseObject)({
      type: import_zod.z.literal("object"),
      value: import_zod.z.record(
        (0, import_utils.looseObject)({
          fieldType: convexValidator,
          optional: import_zod.z.boolean()
        })
      )
    })
  ])
);
//# sourceMappingURL=validator.js.map
