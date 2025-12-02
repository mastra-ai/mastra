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
var typecheck_exports = {};
__export(typecheck_exports, {
  typeCheckFunctions: () => typeCheckFunctions,
  typeCheckFunctionsInMode: () => typeCheckFunctionsInMode
});
module.exports = __toCommonJS(typecheck_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_path = __toESM(require("path"), 1);
var import_log = require("../../bundler/log.js");
var Sentry = __toESM(require("@sentry/node"), 1);
var semver = __toESM(require("semver"), 1);
var import_utils = require("./utils/utils.js");
async function typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir) {
  if (typeCheckMode === "disable") {
    return;
  }
  await typeCheckFunctions(
    ctx,
    functionsDir,
    async (result, logSpecificError, runOnError) => {
      if (result === "cantTypeCheck" && typeCheckMode === "enable" || result === "typecheckFailed") {
        logSpecificError?.();
        (0, import_log.logError)(
          import_chalk.default.gray("To ignore failing typecheck, use `--typecheck=disable`.")
        );
        try {
          const result2 = await runOnError?.();
          if (result2 === "success") {
            return;
          }
        } catch {
        }
        await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null
        });
      }
    }
  );
}
async function typeCheckFunctions(ctx, functionsDir, handleResult) {
  const tsconfig = import_path.default.join(functionsDir, "tsconfig.json");
  if (!ctx.fs.exists(tsconfig)) {
    return handleResult("cantTypeCheck", () => {
      (0, import_log.logError)(
        "Found no convex/tsconfig.json to use to typecheck Convex functions, so skipping typecheck."
      );
      (0, import_log.logError)("Run `npx convex codegen --init` to create one.");
    });
  }
  await runTsc(ctx, ["--project", functionsDir], handleResult);
}
async function runTsc(ctx, tscArgs, handleResult) {
  const tscPath = import_path.default.join("node_modules", "typescript", "bin", "tsc");
  if (!ctx.fs.exists(tscPath)) {
    return handleResult("cantTypeCheck", () => {
      (0, import_log.logError)(
        import_chalk.default.gray("No TypeScript binary found, so skipping typecheck.")
      );
    });
  }
  const versionResult = await (0, import_utils.spawnAsync)(ctx, process.execPath, [
    tscPath,
    "--version"
  ]);
  const version = versionResult.stdout.match(/Version (.*)/)?.[1] ?? null;
  const hasOlderTypeScriptVersion = version && semver.lt(version, "4.8.4");
  await runTscInner(ctx, tscPath, tscArgs, handleResult);
  if (hasOlderTypeScriptVersion) {
    (0, import_log.logError)(
      import_chalk.default.yellow(
        "Convex works best with TypeScript version 4.8.4 or newer -- npm i --save-dev typescript@latest to update."
      )
    );
  }
}
async function runTscInner(ctx, tscPath, tscArgs, handleResult) {
  const result = await (0, import_utils.spawnAsync)(ctx, process.execPath, [
    tscPath,
    ...tscArgs,
    "--listFiles"
  ]);
  if (result.status === null) {
    return handleResult("typecheckFailed", () => {
      (0, import_log.logFailure)(`TypeScript typecheck timed out.`);
      if (result.error) {
        (0, import_log.logError)(import_chalk.default.red(`${result.error.toString()}`));
      }
    });
  }
  const filesTouched = result.stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  let anyPathsFound = false;
  for (const fileTouched of filesTouched) {
    const absPath = import_path.default.resolve(fileTouched);
    let st;
    try {
      st = ctx.fs.stat(absPath);
      anyPathsFound = true;
    } catch {
      continue;
    }
    ctx.fs.registerPath(absPath, st);
  }
  if (filesTouched.length > 0 && !anyPathsFound) {
    const err = new Error(
      `Failed to stat any files emitted by tsc (received ${filesTouched.length})`
    );
    Sentry.captureException(err);
  }
  if (!result.error && result.status === 0) {
    return handleResult("success");
  }
  if (result.stdout.startsWith("error TS18003")) {
    return handleResult("success");
  }
  return handleResult(
    "typecheckFailed",
    () => {
      (0, import_log.logFailure)("TypeScript typecheck via `tsc` failed.");
    },
    async () => {
      (0, import_log.showSpinner)("Collecting TypeScript errors");
      await (0, import_utils.spawnAsync)(
        ctx,
        process.execPath,
        [tscPath, ...tscArgs, "--pretty", "true"],
        {
          stdio: "inherit"
        }
      );
      ctx.fs.invalidate();
      return "success";
    }
  );
}
//# sourceMappingURL=typecheck.js.map
