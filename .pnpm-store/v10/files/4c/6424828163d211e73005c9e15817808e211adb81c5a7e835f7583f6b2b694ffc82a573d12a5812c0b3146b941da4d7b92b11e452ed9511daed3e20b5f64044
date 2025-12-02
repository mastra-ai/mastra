import { findRoot, findRootSync } from ".";
import fixturez from "fixturez";
import path from "path";

import { LernaTool, PnpmTool, RootTool, YarnTool } from "@manypkg/tools";

let f = fixturez(__dirname);

type FindRoot = typeof findRoot | typeof findRootSync;

const runTests = (findRoot: FindRoot) => {
  test("it returns the root of a monorepo", async () => {
    let tmpPath = f.copy("basic");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: YarnTool,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a lerna monorepo", async () => {
    let tmpPath = f.copy("basic-lerna");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: LernaTool,
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
      tool: YarnTool,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a pnpm monorepo", async () => {
    let tmpPath = f.copy("basic-pnpm");
    let monorepoRoot = await findRoot(
      path.join(tmpPath, "packages", "package-one", "src")
    );
    expect(monorepoRoot).toEqual({
      tool: PnpmTool,
      rootDir: tmpPath,
    });
  });

  test("it returns the root of a single-package repo", async () => {
    let tmpPath = f.copy("single-pkg");
    let monorepoRoot = await findRoot(path.join(tmpPath, "src"));
    expect(monorepoRoot).toEqual({
      tool: RootTool,
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
