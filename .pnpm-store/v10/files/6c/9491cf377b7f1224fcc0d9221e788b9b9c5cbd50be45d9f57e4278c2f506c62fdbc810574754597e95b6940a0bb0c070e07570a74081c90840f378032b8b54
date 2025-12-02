"use strict";
import chalk from "chalk";
import path from "path";
import { logError, logFailure, showSpinner } from "../../bundler/log.js";
import * as Sentry from "@sentry/node";
import * as semver from "semver";
import { spawnAsync } from "./utils/utils.js";
export async function typeCheckFunctionsInMode(ctx, typeCheckMode, functionsDir) {
  if (typeCheckMode === "disable") {
    return;
  }
  await typeCheckFunctions(
    ctx,
    functionsDir,
    async (result, logSpecificError, runOnError) => {
      if (result === "cantTypeCheck" && typeCheckMode === "enable" || result === "typecheckFailed") {
        logSpecificError?.();
        logError(
          chalk.gray("To ignore failing typecheck, use `--typecheck=disable`.")
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
export async function typeCheckFunctions(ctx, functionsDir, handleResult) {
  const tsconfig = path.join(functionsDir, "tsconfig.json");
  if (!ctx.fs.exists(tsconfig)) {
    return handleResult("cantTypeCheck", () => {
      logError(
        "Found no convex/tsconfig.json to use to typecheck Convex functions, so skipping typecheck."
      );
      logError("Run `npx convex codegen --init` to create one.");
    });
  }
  await runTsc(ctx, ["--project", functionsDir], handleResult);
}
async function runTsc(ctx, tscArgs, handleResult) {
  const tscPath = path.join("node_modules", "typescript", "bin", "tsc");
  if (!ctx.fs.exists(tscPath)) {
    return handleResult("cantTypeCheck", () => {
      logError(
        chalk.gray("No TypeScript binary found, so skipping typecheck.")
      );
    });
  }
  const versionResult = await spawnAsync(ctx, process.execPath, [
    tscPath,
    "--version"
  ]);
  const version = versionResult.stdout.match(/Version (.*)/)?.[1] ?? null;
  const hasOlderTypeScriptVersion = version && semver.lt(version, "4.8.4");
  await runTscInner(ctx, tscPath, tscArgs, handleResult);
  if (hasOlderTypeScriptVersion) {
    logError(
      chalk.yellow(
        "Convex works best with TypeScript version 4.8.4 or newer -- npm i --save-dev typescript@latest to update."
      )
    );
  }
}
async function runTscInner(ctx, tscPath, tscArgs, handleResult) {
  const result = await spawnAsync(ctx, process.execPath, [
    tscPath,
    ...tscArgs,
    "--listFiles"
  ]);
  if (result.status === null) {
    return handleResult("typecheckFailed", () => {
      logFailure(`TypeScript typecheck timed out.`);
      if (result.error) {
        logError(chalk.red(`${result.error.toString()}`));
      }
    });
  }
  const filesTouched = result.stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0);
  let anyPathsFound = false;
  for (const fileTouched of filesTouched) {
    const absPath = path.resolve(fileTouched);
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
      logFailure("TypeScript typecheck via `tsc` failed.");
    },
    async () => {
      showSpinner("Collecting TypeScript errors");
      await spawnAsync(
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
