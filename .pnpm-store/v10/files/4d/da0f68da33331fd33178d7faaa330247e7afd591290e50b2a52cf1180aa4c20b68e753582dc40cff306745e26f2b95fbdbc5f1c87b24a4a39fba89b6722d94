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
var pagination_exports = {};
__export(pagination_exports, {
  paginationOptsValidator: () => paginationOptsValidator,
  paginationResultValidator: () => paginationResultValidator
});
module.exports = __toCommonJS(pagination_exports);
var import_validator = require("../values/validator.js");
const paginationOptsValidator = import_validator.v.object({
  numItems: import_validator.v.number(),
  cursor: import_validator.v.union(import_validator.v.string(), import_validator.v.null()),
  endCursor: import_validator.v.optional(import_validator.v.union(import_validator.v.string(), import_validator.v.null())),
  id: import_validator.v.optional(import_validator.v.number()),
  maximumRowsRead: import_validator.v.optional(import_validator.v.number()),
  maximumBytesRead: import_validator.v.optional(import_validator.v.number())
});
function paginationResultValidator(itemValidator) {
  return import_validator.v.object({
    page: import_validator.v.array(itemValidator),
    continueCursor: import_validator.v.string(),
    isDone: import_validator.v.boolean(),
    splitCursor: import_validator.v.optional(import_validator.v.union(import_validator.v.string(), import_validator.v.null())),
    pageStatus: import_validator.v.optional(
      import_validator.v.union(
        import_validator.v.literal("SplitRecommended"),
        import_validator.v.literal("SplitRequired"),
        import_validator.v.null()
      )
    )
  });
}
//# sourceMappingURL=pagination.js.map
