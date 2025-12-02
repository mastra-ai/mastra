import { describe, expect, test } from "vitest";
import fixturez from "fixturez";
import path from "node:path";
import { findRoot, findRootSync } from "./index.ts";

import {
  BunTool,
  LernaTool,
  NpmTool,
  PnpmTool,
  RootTool,
  YarnTool,
} from "@manypkg/tools";

let f = fixturez(__dirname);

type FindRoot = typeof findRoot | typeof findRootSync;

const runTests = (findRoot: FindRoot) => {
  test("it returns the root of a monorepo", async () => {
    let tmpPath = f.copy("basic");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: YarnTool.type,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of an npm monorepo", async () => {
    let tmpPath = f.copy("basic-npm");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: NpmTool.type,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a lerna monorepo", async () => {
    let tmpPath = f.copy("basic-lerna");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: LernaTool.type,
      rootDir: tmpPath,
    });
  });

  test("treats a lerna monorepo with useWorkspaces on as a yarn monorepo", async () => {
    let tmpPath = f.copy("basic");
    // technically legal placement for lerna.json, but broken in practice
    // because it is not a sibling of the root manifest. placed here merely
    // to be encountered "before" the root manifest and its valid workspaces config.
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: YarnTool.type,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a pnpm monorepo", async () => {
    let tmpPath = f.copy("basic-pnpm");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: PnpmTool.type,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a bun monorepo", async () => {
    let tmpPath = f.copy("basic-bun");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: BunTool.type,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a bun monorepo with JSON lock file", async () => {
    let tmpPath = f.copy("basic-bun-json-lock");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: BunTool.type,
      rootDir: tmpPath,
    });
  });

  test("it does not detect bun monorepo without lock file", async () => {
    let tmpPath = f.copy("bun-no-lock");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    // Should be detected as a root tool since it has workspaces but no lock file
    expect(monorepoRoot).toEqual({
      tool: RootTool.type,
      rootDir: path.join(tmpPath, "packages", "package-one"),
    });
  });

  test("it returns the root of a single-package repo", async () => {
    let tmpPath = f.copy("single-pkg");
    let monorepoRoot = await findRoot(path.join(tmpPath, "src"));
    expect(monorepoRoot).toEqual({
      tool: RootTool.type,
      rootDir: tmpPath,
    });
  });

  test("it will not find a lerna monorepo if only PnpmTool is allowed", async () => {
    let tmpPath = f.copy("basic-lerna");
    await expect(async () =>
      findRoot(path.join(tmpPath, "packages", "package-one", "src"), {
        tools: [PnpmTool],
      })
    ).rejects.toThrowError(
      /No monorepo matching the list of supported monorepos could be found upwards from directory /
    );
  });
};

describe("findRoot", () => {
  runTests(findRoot);
});

describe("findRootSync", () => {
  runTests(findRootSync);
});
