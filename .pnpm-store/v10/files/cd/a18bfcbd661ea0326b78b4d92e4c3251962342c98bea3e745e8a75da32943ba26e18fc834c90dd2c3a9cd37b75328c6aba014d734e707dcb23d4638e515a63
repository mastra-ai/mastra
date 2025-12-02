"use strict";
import path from "path";
import { findUp } from "find-up";
import { findParentConfigs } from "../cli/lib/utils/utils.js";
async function resolveNodeModule(ctx, moduleDir, resolveDir) {
  let nodeModulesPath;
  while (nodeModulesPath = await findUp("node_modules", {
    type: "directory",
    cwd: resolveDir
  })) {
    const maybePath = path.join(nodeModulesPath, moduleDir);
    if (ctx.fs.exists(maybePath)) {
      return maybePath;
    }
    resolveDir = path.dirname(path.dirname(nodeModulesPath));
  }
  return null;
}
function getModule(importPath) {
  if (importPath.startsWith("@")) {
    const split = importPath.split("/");
    return {
      name: `${split[0]}/${split[1]}`,
      dirName: path.join(split[0], split[1])
    };
  } else {
    const moduleName = importPath.split("/")[0];
    return {
      name: moduleName,
      dirName: moduleName
    };
  }
}
export function createExternalPlugin(ctx, externalPackages) {
  const externalModuleNames = /* @__PURE__ */ new Set();
  const bundledModuleNames = /* @__PURE__ */ new Set();
  return {
    plugin: {
      name: "convex-node-externals",
      setup(build) {
        build.onResolve({ namespace: "file", filter: /.*/ }, async (args) => {
          if (args.path.startsWith(".")) {
            return null;
          }
          const module = getModule(args.path);
          const externalPackage = externalPackages.get(module.name);
          if (externalPackage) {
            const resolved = await resolveNodeModule(
              ctx,
              module.dirName,
              args.resolveDir
            );
            if (resolved && externalPackage.path === resolved) {
              externalModuleNames.add(module.name);
              return { path: args.path, external: true };
            }
          }
          bundledModuleNames.add(module.name);
          return null;
        });
      }
    },
    externalModuleNames,
    bundledModuleNames
  };
}
export async function computeExternalPackages(ctx, externalPackagesAllowList) {
  if (externalPackagesAllowList.length === 0) {
    return /* @__PURE__ */ new Map();
  }
  const { parentPackageJson: packageJsonPath } = await findParentConfigs(ctx);
  const externalPackages = /* @__PURE__ */ new Map();
  let packageJson;
  try {
    const packageJsonString = ctx.fs.readUtf8File(packageJsonPath);
    packageJson = JSON.parse(packageJsonString);
  } catch (error) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Couldn't parse "${packageJsonPath}". Make sure it's a valid JSON. Error: ${error}`
    });
  }
  for (const key of [
    "dependencies",
    "devDependencies",
    "peerDependencies",
    "optionalDependencies"
  ]) {
    for (const [packageName, packageJsonVersion] of Object.entries(
      packageJson[key] ?? {}
    )) {
      if (externalPackages.has(packageName)) {
        continue;
      }
      if (typeof packageJsonVersion !== "string") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Invalid "${packageJsonPath}". "${key}.${packageName}" version has type ${typeof packageJsonVersion}.`
        });
      }
      if (!shouldMarkExternal(
        packageName,
        packageJsonVersion,
        externalPackagesAllowList
      )) {
        continue;
      }
      const packagePath = path.join(
        path.dirname(packageJsonPath),
        "node_modules",
        getModule(packageName).dirName
      );
      if (ctx.fs.exists(packagePath)) {
        externalPackages.set(packageName, {
          path: packagePath
        });
      }
    }
  }
  return externalPackages;
}
export function shouldMarkExternal(packageName, packageJsonVersion, externalPackagesAllowList) {
  if (packageName === "convex") {
    return false;
  }
  if (packageJsonVersion.startsWith("file:") || packageJsonVersion.startsWith("git+file://")) {
    return false;
  }
  if (packageJsonVersion.startsWith("http://") || packageJsonVersion.startsWith("https://") || packageJsonVersion.startsWith("git://") || packageJsonVersion.startsWith("git+ssh://") || packageJsonVersion.startsWith("git+http://") || packageJsonVersion.startsWith("git+https://")) {
    return false;
  }
  return externalPackagesAllowList.includes(packageName) || externalPackagesAllowList.includes("*");
}
export async function findExactVersionAndDependencies(ctx, moduleName, modulePath) {
  const modulePackageJsonPath = path.join(modulePath, "package.json");
  let modulePackageJson;
  try {
    const packageJsonString = ctx.fs.readUtf8File(modulePackageJsonPath);
    modulePackageJson = JSON.parse(packageJsonString);
  } catch {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `Missing "${modulePackageJsonPath}", which is required for
      installing external package "${moduleName}" configured in convex.json.`
    });
  }
  if (modulePackageJson["version"] === void 0) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      printedMessage: `"${modulePackageJsonPath}" misses a 'version' field. which is required for
      installing external package "${moduleName}" configured in convex.json.`
    });
  }
  const peerAndOptionalDependencies = /* @__PURE__ */ new Set();
  for (const key of ["peerDependencies", "optionalDependencies"]) {
    for (const [packageName, packageJsonVersion] of Object.entries(
      modulePackageJson[key] ?? {}
    )) {
      if (typeof packageJsonVersion !== "string") {
        return await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: `Invalid "${modulePackageJsonPath}". "${key}.${packageName}" version has type ${typeof packageJsonVersion}.`
        });
      }
      peerAndOptionalDependencies.add(packageName);
    }
  }
  return {
    version: modulePackageJson["version"],
    peerAndOptionalDependencies
  };
}
//# sourceMappingURL=external.js.map
