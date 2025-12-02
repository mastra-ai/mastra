import { test, expect } from "vitest";
import { filterBuilderImpl } from "./filter_builder_impl.js";

test("Serialize expression with literals", () => {
  const predicate = filterBuilderImpl.and(
    filterBuilderImpl.eq(filterBuilderImpl.field("test"), 3),
    true as any,
  );
  const expected = {
    $and: [{ $eq: [{ $field: "test" }, { $literal: 3 }] }, { $literal: true }],
  };
  expect((predicate as any).serialize()).toEqual(expected);
});
