"use strict";
import { v } from "../values/validator.js";
export const paginationOptsValidator = v.object({
  numItems: v.number(),
  cursor: v.union(v.string(), v.null()),
  endCursor: v.optional(v.union(v.string(), v.null())),
  id: v.optional(v.number()),
  maximumRowsRead: v.optional(v.number()),
  maximumBytesRead: v.optional(v.number())
});
export function paginationResultValidator(itemValidator) {
  return v.object({
    page: v.array(itemValidator),
    continueCursor: v.string(),
    isDone: v.boolean(),
    splitCursor: v.optional(v.union(v.string(), v.null())),
    pageStatus: v.optional(
      v.union(
        v.literal("SplitRecommended"),
        v.literal("SplitRequired"),
        v.null()
      )
    )
  });
}
//# sourceMappingURL=pagination.js.map
