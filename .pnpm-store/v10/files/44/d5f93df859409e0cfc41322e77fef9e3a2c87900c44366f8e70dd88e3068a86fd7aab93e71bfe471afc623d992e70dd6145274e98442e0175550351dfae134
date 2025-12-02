import { assert } from "../test/type_testing.js";
import { test } from "vitest";
import {
  PaginationOptions,
  PaginationResult,
  paginationOptsValidator,
  paginationResultValidator,
} from "./pagination.js";
import { Infer, v } from "../values/validator.js";

test("paginationOptsValidator matches the paginationOpts type", () => {
  type validatorType = Infer<typeof paginationOptsValidator>;
  assert<validatorType extends PaginationOptions ? true : false>();
  // All optional fields exist and have the correct type.
  assert<
    Required<validatorType> extends Required<PaginationOptions> ? true : false
  >();
});

test("paginationResultValidator with string items", () => {
  const _validator = paginationResultValidator(v.string());
  type validatorType = Infer<typeof _validator>;
  type expectedType = PaginationResult<string>;

  // Check that the inferred type matches PaginationResult<string>
  assert<validatorType extends expectedType ? true : false>();
  assert<expectedType extends validatorType ? true : false>();
});

test("paginationResultValidator with object items", () => {
  const itemValidator = v.object({
    _id: v.id("users"),
    _creationTime: v.number(),
    name: v.string(),
    email: v.optional(v.string()),
  });
  const _validator = paginationResultValidator(itemValidator);
  type validatorType = Infer<typeof _validator>;
  type itemType = Infer<typeof itemValidator>;
  type expectedType = PaginationResult<itemType>;

  // Check that the inferred type matches PaginationResult with the correct item type
  assert<validatorType extends expectedType ? true : false>();
  assert<expectedType extends validatorType ? true : false>();

  // Verify the page array has the correct item type
  type pageType = validatorType["page"];
  assert<pageType extends itemType[] ? true : false>();
});
