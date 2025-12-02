import { test, expect } from "vitest";
import { parseFunctionName } from "./run.js";
import { oneoffContext } from "../../bundler/context.js";

test("parseFunctionName", async () => {
  const originalContext = await oneoffContext({
    url: undefined,
    adminKey: undefined,
    envFile: undefined,
  });
  const files = new Set<string>();
  const ctx = {
    ...originalContext,
    fs: {
      ...originalContext.fs,
      exists: (file: string) => files.has(file),
    },
  };

  files.add("convex/foo/bar.ts");
  files.add("convex/convex/bar/baz.ts");
  files.add("src/convex/foo/bar.ts");

  expect(await parseFunctionName(ctx, "api.foo.bar", "convex/")).toEqual(
    "foo:bar",
  );
  expect(await parseFunctionName(ctx, "internal.foo.bar", "convex/")).toEqual(
    "foo:bar",
  );
  expect(await parseFunctionName(ctx, "foo/bar", "convex/")).toEqual(
    "foo/bar:default",
  );
  expect(await parseFunctionName(ctx, "foo/bar:baz", "convex/")).toEqual(
    "foo/bar:baz",
  );
  expect(await parseFunctionName(ctx, "convex/foo/bar", "convex/")).toEqual(
    "foo/bar:default",
  );
  expect(await parseFunctionName(ctx, "convex/foo/bar.ts", "convex/")).toEqual(
    "foo/bar:default",
  );
  expect(
    await parseFunctionName(ctx, "convex/foo/bar.ts:baz", "convex/"),
  ).toEqual("foo/bar:baz");
  expect(await parseFunctionName(ctx, "convex/bar/baz", "convex/")).toEqual(
    "convex/bar/baz:default",
  );
  expect(
    await parseFunctionName(ctx, "src/convex/foo/bar", "src/convex/"),
  ).toEqual("foo/bar:default");
  expect(await parseFunctionName(ctx, "foo/bar", "src/convex/")).toEqual(
    "foo/bar:default",
  );
});
