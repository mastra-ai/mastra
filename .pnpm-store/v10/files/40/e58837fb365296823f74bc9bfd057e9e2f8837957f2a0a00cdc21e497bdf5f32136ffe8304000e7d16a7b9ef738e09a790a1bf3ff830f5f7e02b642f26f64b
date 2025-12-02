"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var external_exports = {};
__export(external_exports, {
  computeExternalPackages: () => computeExternalPackages,
  createExternalPlugin: () => createExternalPlugin,
  findExactVersionAndDependencies: () => findExactVersionAndDependencies,
  shouldMarkExternal: () => shouldMarkExternal
});
module.exports = __toCommonJS(external_exports);
var import_path = __toESM(require("path"), 1);
var import_find_up = require("find-up");
var import_utils = require("../cli/lib/utils/utils.js");
async function resolveNodeModule(ctx, moduleDir, resolveDir) {
  let nodeModulesPath;
  while (nodeModulesPath = await (0, import_find_up.findUp)("node_modules", {
    type: "directory",
    cwd: resolveDir
  })) {
    const maybePath = import_path.default.join(nodeModulesPath, moduleDir);
    if (ctx.fs.exists(maybePath)) {
      return maybePath;
    }
    resolveDir = import_path.default.dirname(import_path.default.dirname(nodeModulesPath));
  }
  return null;
}
function getModule(importPath) {
  if (importPath.startsWith("@")) {
    const split = importPath.split("/");
    return {
      name: `${split[0]}/${split[1]}`,
      dirName: import_path.default.join(split[0], split[1])
    };
  } else {
    const moduleName = importPath.split("/")[0];
    return {
      name: moduleName,
      dirName: moduleName
    };
  }
}
function createExternalPlugin(ctx, externalPackages) {
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
          const module2 = getModule(args.path);
          const externalPackage = externalPackages.get(module2.name);
          if (externalPackage) {
            const resolved = await resolveNodeModule(
              ctx,
              module2.dirName,
              args.resolveDir
            );
            if (resolved && externalPackage.path === resolved) {
              externalModuleNames.add(module2.name);
              return { path: args.path, external: true };
            }
          }
          bundledModuleNames.add(module2.name);
          return null;
        });
      }
    },
    externalModuleNames,
    bundledModuleNames
  };
}
async function computeExternalPackages(ctx, externalPackagesAllowList) {
  if (externalPackagesAllowList.length === 0) {
    return /* @__PURE__ */ new Map();
  }
  const { parentPackageJson: packageJsonPath } = await (0, import_utils.findParentConfigs)(ctx);
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
      const packagePath = import_path.default.join(
        import_path.default.dirname(packageJsonPath),
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
function shouldMarkExternal(packageName, packageJsonVersion, externalPackagesAllowList) {
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
async function findExactVersionAndDependencies(ctx, moduleName, modulePath) {
  const modulePackageJsonPath = import_path.default.join(modulePath, "package.json");
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
