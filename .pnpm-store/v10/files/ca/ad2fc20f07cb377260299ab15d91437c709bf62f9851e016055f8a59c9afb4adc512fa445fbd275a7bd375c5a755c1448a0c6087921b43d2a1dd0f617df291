import { test, expect } from "vitest";
import { importPath, moduleIdentifier } from "./api.js";

test("importPath", () => {
  expect(importPath("foo.ts")).toEqual("foo");
  expect(importPath("foo.tsx")).toEqual("foo");
  expect(importPath("foo\\bar.ts")).toEqual("foo/bar");
  expect(importPath("foo/bar.ts")).toEqual("foo/bar");
});

test("moduleIdentifier", () => {
  expect(moduleIdentifier("foo.ts")).toEqual("foo");
  // This mapping is ambiguous! This is a codegen implementation detail so
  // this can be changed without requiring changes beyond running codegen.
  expect(moduleIdentifier("foo/bar.ts")).toEqual("foo_bar");
  expect(moduleIdentifier("foo_bar.ts")).toEqual("foo_bar");
  expect(moduleIdentifier("foo-bar.ts")).toEqual("foo_bar");
});
