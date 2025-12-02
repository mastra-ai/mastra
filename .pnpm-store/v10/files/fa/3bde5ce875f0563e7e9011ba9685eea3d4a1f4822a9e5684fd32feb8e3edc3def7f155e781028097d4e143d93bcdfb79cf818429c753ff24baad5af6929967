/* eslint-disable @typescript-eslint/no-unused-vars */
import { GenericId } from "../values/index.js";
import { test } from "vitest";
import { assert, Equals } from "../test/type_testing.js";
import { Expression, FilterBuilder } from "./filter_builder.js";

type Document = {
  _id: GenericId<"tableName">;
  numberField: number;
  bigintField: bigint;
  nestedObject: {
    numberField: number;
  };
};

type TableInfo = {
  document: Document;
  fieldPaths:
    | "_id"
    | "numberField"
    | "bigintField"
    | "nestedObject"
    | "nestedObject.numberField";
  indexes: {};
  searchIndexes: {};
  vectorIndexes: {};
};

type FB = FilterBuilder<TableInfo>;

test("eq must have the same input types", () => {
  // This breaks because we're comparing a string and a number.
  function brokenEq(q: FB) {
    // @ts-expect-error Using this directive to assert this is an error.
    return q.eq("string", 123);
  }

  function eq(q: FB) {
    return q.eq("string", "another string");
  }
  type Result = ReturnType<typeof eq>;
  type Expected = Expression<boolean>;
  assert<Equals<Result, Expected>>();
});

test("neq must have the same input types", () => {
  // This breaks because we're comparing a string and a number.
  function brokenNeq(q: FB) {
    // @ts-expect-error Using this directive to assert this is an error.
    return q.neq("string", 123);
  }

  function neq(q: FB) {
    return q.neq("string", "another string");
  }
  type Result = ReturnType<typeof neq>;
  type Expected = Expression<boolean>;
  assert<Equals<Result, Expected>>();
});

test("neg returns number when number is passed in", () => {
  function negNumber(q: FB) {
    return q.neg(q.field("numberField"));
  }
  type Result = ReturnType<typeof negNumber>;
  type Expected = Expression<number>;
  assert<Equals<Result, Expected>>();
});

test("neg returns bigint when bigint is passed in", () => {
  function negBigint(q: FB) {
    return q.neg(q.field("bigintField"));
  }
  type Result = ReturnType<typeof negBigint>;
  type Expected = Expression<bigint>;
  assert<Equals<Result, Expected>>();
});

test("field doesn't compile on invalid field paths", () => {
  function broken(q: FB) {
    // @ts-expect-error Using this directive to assert this is an error.
    return q.field("notAField");
  }
});

test("field determines field type", () => {
  function idField(q: FB) {
    return q.field("_id");
  }
  type Result = ReturnType<typeof idField>;
  type Expected = Expression<GenericId<"tableName">>;
  assert<Equals<Result, Expected>>();
});

test("field determines field type in nested field", () => {
  function nestedField(q: FB) {
    return q.field("nestedObject.numberField");
  }
  type Result = ReturnType<typeof nestedField>;
  type Expected = Expression<number>;
  assert<Equals<Result, Expected>>();
});
