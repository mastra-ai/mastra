import { expect, test, afterEach, vi } from "vitest";
import { oneoffContext } from "./context.js";

// Although these tests are run as ESM by ts-lint, this file is built as both
// CJS and ESM by TypeScript so normal recipes like `__dirname` for getting the
// script directory don't work.
const dirname = "src/bundler";

import {
  bundle,
  doesImportConvexHttpRouter,
  entryPoints,
  entryPointsByEnvironment,
  useNodeDirectiveRegex,
  mustBeIsolate,
} from "./index.js";

const sorted = <T>(arr: T[], key: (el: T) => any): T[] => {
  const newArr = [...arr];
  const cmp = (a: T, b: T) => {
    if (key(a) < key(b)) return -1;
    if (key(a) > key(b)) return 1;
    return 0;
  };
  return newArr.sort(cmp);
};

const getDefaultCtx = async () => {
  return await oneoffContext({
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });
};

afterEach(() => {
  vi.resetAllMocks();
});

test("bundle function is present", () => {
  expect(typeof bundle).toEqual("function");
});

test("bundle finds JavaScript functions", async () => {
  const fixtureDir = dirname + "/test_fixtures/js/project01";
  const ctx = await getDefaultCtx();
  const entryPoints = await entryPointsByEnvironment(ctx, fixtureDir);
  const bundles = sorted(
    (await bundle(ctx, fixtureDir, entryPoints.isolate, false, "browser"))
      .modules,
    (b) => b.path,
  ).filter((bundle) => !bundle.path.includes("_deps"));
  expect(bundles).toHaveLength(2);
  expect(bundles[0].path).toEqual("bar.js");
  expect(bundles[1].path).toEqual("foo.js");
});

test("returns true when simple import httpRouter found", async () => {
  const result = await doesImportConvexHttpRouter(`
    import { httpRouter } from "convex/server";

    export const val = 1;
    `);
  expect(result).toBeTruthy();
});

test("returns false when httpRouter is not imported", async () => {
  const result = await doesImportConvexHttpRouter(`
    export const val = 1;
    `);
  expect(result).toBeFalsy();
});

test("returns true when multiline import httpRouter found", async () => {
  const result = await doesImportConvexHttpRouter(`
    import {
      httpRouter
    } from "convex/server";

    export const val = 1;
    `);
  expect(result).toBeTruthy();
});

test("returns true when httpRouter is imported with alias", async () => {
  const result = await doesImportConvexHttpRouter(`
    import { httpRouter as router } from "convex/server";

    export const val = 1;
    `);
  expect(result).toBeTruthy();
});

test("returns true when httpRouter is imported with alias and multiline", async () => {
  const result = await doesImportConvexHttpRouter(`
    import {
      httpRouter as router
    } from "convex/server";

    export const val = 1;
    `);
  expect(result).toBeTruthy();
});

test("returns true when multiple imports and httpRouter is imported", async () => {
  const result = await doesImportConvexHttpRouter(`
    import { cronJobs, httpRouter } from "convex/server";

    export const val = 1;
    `);
  expect(result).toBeTruthy();
});

test("bundle warns about https.js|ts at top level", async () => {
  const fixtureDir = dirname + "/test_fixtures/js/project_with_https";
  const logSpy = vi.spyOn(process.stderr, "write");
  await entryPoints(await getDefaultCtx(), fixtureDir);
  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("https"));
});

test("bundle does not warn about https.js|ts which is not at top level", async () => {
  const fixtureDir =
    dirname + "/test_fixtures/js/project_with_https_not_at_top_level";
  const logSpy = vi.spyOn(process.stderr, "write");
  await entryPoints(await getDefaultCtx(), fixtureDir);
  expect(logSpy).toHaveBeenCalledTimes(0);
});

test("bundle does not warn about https.js|ts which does not import httpRouter", async () => {
  const fixtureDir =
    dirname + "/test_fixtures/js/project_with_https_without_router";
  const logSpy = vi.spyOn(process.stderr, "write");
  await entryPoints(await getDefaultCtx(), fixtureDir);
  expect(logSpy).toHaveBeenCalledTimes(0);
});

test("use node regex", () => {
  // Double quotes
  expect('"use node";').toMatch(useNodeDirectiveRegex);
  // Single quotes
  expect("'use node';").toMatch(useNodeDirectiveRegex);
  // No semi column
  expect('"use node"').toMatch(useNodeDirectiveRegex);
  expect("'use node'").toMatch(useNodeDirectiveRegex);
  // Extra spaces
  expect('   "use node"   ').toMatch(useNodeDirectiveRegex);
  expect("   'use node'   ").toMatch(useNodeDirectiveRegex);

  // Nothing
  expect("").not.toMatch(useNodeDirectiveRegex);
  // No quotes
  expect("use node").not.toMatch(useNodeDirectiveRegex);
  // In a comment
  expect('// "use node";').not.toMatch(useNodeDirectiveRegex);
  // Typo
  expect('"use nod";').not.toMatch(useNodeDirectiveRegex);
  // Extra quotes
  expect('""use node"";').not.toMatch(useNodeDirectiveRegex);
  expect("''use node'';").not.toMatch(useNodeDirectiveRegex);
  // Extra semi colons
  expect('"use node";;;').not.toMatch(useNodeDirectiveRegex);
  // Twice
  expect('"use node";"use node";').not.toMatch(useNodeDirectiveRegex);
});

test("must use isolate", () => {
  expect(mustBeIsolate("http.js")).toBeTruthy();
  expect(mustBeIsolate("http.mjs")).toBeTruthy();
  expect(mustBeIsolate("http.ts")).toBeTruthy();
  expect(mustBeIsolate("crons.js")).toBeTruthy();
  expect(mustBeIsolate("crons.cjs")).toBeTruthy();
  expect(mustBeIsolate("crons.ts")).toBeTruthy();
  expect(mustBeIsolate("schema.js")).toBeTruthy();
  expect(mustBeIsolate("schema.jsx")).toBeTruthy();
  expect(mustBeIsolate("schema.ts")).toBeTruthy();
  expect(mustBeIsolate("schema.js")).toBeTruthy();

  expect(mustBeIsolate("http.sample.js")).not.toBeTruthy();
  expect(mustBeIsolate("https.js")).not.toBeTruthy();
  expect(mustBeIsolate("schema2.js")).not.toBeTruthy();
  expect(mustBeIsolate("schema/http.js")).not.toBeTruthy();
});
