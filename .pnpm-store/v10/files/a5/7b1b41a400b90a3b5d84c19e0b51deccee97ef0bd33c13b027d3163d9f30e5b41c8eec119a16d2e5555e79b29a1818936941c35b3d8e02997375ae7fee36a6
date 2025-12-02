import { PluginBuild } from "esbuild";
import type { Plugin } from "esbuild";
import { Context } from "./context.js";
import path from "path";

import { findUp } from "find-up";
import { findParentConfigs } from "../cli/lib/utils/utils.js";

/**
 * Mimics Node.js node_modules resolution. Ideally we would be able to
 * reuse the logic in esbuild but calling build.resolve() from onResolve()
 * results in infinite recursion. See https://esbuild.github.io/plugins/#resolve
 */
async function resolveNodeModule(
  ctx: Context,
  moduleDir: string,
  resolveDir: string,
): Promise<string | null> {
  let nodeModulesPath: string | undefined;

  while (
    (nodeModulesPath = await findUp("node_modules", {
      type: "directory",
      cwd: resolveDir,
    }))
  ) {
    const maybePath = path.join(nodeModulesPath, moduleDir);
    if (ctx.fs.exists(maybePath)) {
      return maybePath;
    }
    resolveDir = path.dirname(path.dirname(nodeModulesPath));
  }

  return null;
}

function getModule(importPath: string): { name: string; dirName: string } {
  // In case of scoped package
  if (importPath.startsWith("@")) {
    const split = importPath.split("/");
    return {
      name: `${split[0]}/${split[1]}`,
      dirName: path.join(split[0], split[1]),
    };
  } else {
    const moduleName = importPath.split("/")[0];
    return {
      name: moduleName,
      dirName: moduleName,
    };
  }
}

export type ExternalPackage = {
  path: string;
};

// Inspired by https://www.npmjs.com/package/esbuild-node-externals.
export function createExternalPlugin(
  ctx: Context,
  externalPackages: Map<string, ExternalPackage>,
): {
  plugin: Plugin;
  externalModuleNames: Set<string>;
  bundledModuleNames: Set<string>;
} {
  const externalModuleNames = new Set<string>();
  const bundledModuleNames = new Set<string>();
  return {
    plugin: {
      name: "convex-node-externals",
      setup(build: PluginBuild) {
        // On every module resolved, we check if the module name should be an external
        build.onResolve({ namespace: "file", filter: /.*/ }, async (args) => {
          if (args.path.startsWith(".")) {
            // Relative import.
            return null;
          }

          const module = getModule(args.path);
          const externalPackage = externalPackages.get(module.name);
          if (externalPackage) {
            const resolved = await resolveNodeModule(
              ctx,
              module.dirName,
              args.resolveDir,
            );
            if (resolved && externalPackage.path === resolved) {
              // Mark as external.
              externalModuleNames.add(module.name);
              return { path: args.path, external: true };
            }
          }

          bundledModuleNames.add(module.name);
          return null;
        });
      },
    },
    externalModuleNames: externalModuleNames,
    bundledModuleNames: bundledModuleNames,
  };
}

// Returns the versions of the packages referenced by the package.json.
export async function computeExternalPackages(
  ctx: Context,
  externalPackagesAllowList: string[],
): Promise<Map<string, ExternalPackage>> {
  if (externalPackagesAllowList.length === 0) {
    // No external packages in the allow list.
    return new Map<string, ExternalPackage>();
  }

  const { parentPackageJson: packageJsonPath } = await findParentConfigs(ctx);
  const externalPackages = new Map<string, ExternalPackage>();
  let packageJson: any;
  try {
    const packageJsonString = ctx.fs.readUtf8File(packageJsonPath);
    packageJson = JSON.parse(packageJsonString);
  } catch (error: any) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Couldn't parse "${packageJsonPath}". Make sure it's a valid JSON. Error: ${error}`,
    });
  }

  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    for (const [packageName, packageJsonVersion] of Object.entries(
      packageJson[key] ?? {},
    )) {
      if (externalPackages.has(packageName)) {
        // Package version and path already found.
        continue;
      }

      if (typeof packageJsonVersion !== "string") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Invalid "${packageJsonPath}". "${key}.${packageName}" version has type ${typeof packageJsonVersion}.`,
        });
      }

      if (
        !shouldMarkExternal(
          packageName,
          packageJsonVersion,
          externalPackagesAllowList,
        )
      ) {
        // Package should be bundled.
        continue;
      }

      // Check if the package path is referenced.
      const packagePath = path.join(
        path.dirname(packageJsonPath),
        "node_modules",
        getModule(packageName).dirName,
      );
      if (ctx.fs.exists(packagePath)) {
        externalPackages.set(packageName, {
          path: packagePath,
        });
      }
    }
  }

  return externalPackages;
}

export function shouldMarkExternal(
  packageName: string,
  packageJsonVersion: string,
  externalPackagesAllowList: string[],
): boolean {
  // Always bundle convex.
  if (packageName === "convex") {
    return false;
  }

  if (
    packageJsonVersion.startsWith("file:") ||
    packageJsonVersion.startsWith("git+file://")
  ) {
    // Bundle instead of marking as external.
    return false;
  }
  if (
    packageJsonVersion.startsWith("http://") ||
    packageJsonVersion.startsWith("https://") ||
    packageJsonVersion.startsWith("git://") ||
    packageJsonVersion.startsWith("git+ssh://") ||
    packageJsonVersion.startsWith("git+http://") ||
    packageJsonVersion.startsWith("git+https://")
  ) {
    // Installing those might or might not work. There are some corner cases
    // like http://127.0.0.1/. Lets bundle for time being.
    return false;
  }

  return (
    externalPackagesAllowList.includes(packageName) ||
    externalPackagesAllowList.includes("*")
  );
}

export async function findExactVersionAndDependencies(
  ctx: Context,
  moduleName: string,
  modulePath: string,
): Promise<{
  version: string;
  peerAndOptionalDependencies: Set<string>;
}> {
  const modulePackageJsonPath = path.join(modulePath, "package.json");
  let modulePackageJson: any;
  try {
    const packageJsonString = ctx.fs.readUtf8File(modulePackageJsonPath);
    modulePackageJson = JSON.parse(packageJsonString);
  } catch {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Missing "${modulePackageJsonPath}", which is required for
      installing external package "${moduleName}" configured in convex.json.`,
    });
  }
  if (modulePackageJson["version"] === undefined) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `"${modulePackageJsonPath}" misses a 'version' field. which is required for
      installing external package "${moduleName}" configured in convex.json.`,
    });
  }

  const peerAndOptionalDependencies = new Set<string>();
  for (const key of ["peerDependencies", "optionalDependencies"]) {
    for (const [packageName, packageJsonVersion] of Object.entries(
      modulePackageJson[key] ?? {},
    )) {
      if (typeof packageJsonVersion !== "string") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Invalid "${modulePackageJsonPath}". "${key}.${packageName}" version has type ${typeof packageJsonVersion}.`,
        });
      }
      peerAndOptionalDependencies.add(packageName);
    }
  }

  return {
    version: modulePackageJson["version"],
    peerAndOptionalDependencies: peerAndOptionalDependencies,
  };
}
