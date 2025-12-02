import chalk from "chalk";
import path from "path";
import { Context } from "../../bundler/context.js";
import { logError, logFailure, showSpinner } from "../../bundler/log.js";
import * as Sentry from "@sentry/node";
import * as semver from "semver";
import { spawnAsync } from "./utils/utils.js";

export type TypecheckResult = "cantTypeCheck" | "success" | "typecheckFailed";

export type TypeCheckMode = "enable" | "try" | "disable";

type TypecheckResultHandler = (
  result: TypecheckResult,
  logSpecificError?: () => void,
  // If given, we run it to print out errors.
  // We expect it to throw or resolve to "success"
  // if a concurrent change invalidated the error result.
  runOnError?: () => Promise<"success">,
) => Promise<void>;

/**
 * Conditionally run a typecheck function and interpret the result.
 *
 * If typeCheckMode === "disable", never run the typecheck function.
 * If typeCheckMode === "enable", run the typecheck and crash if typechecking
 * fails or we can't find tsc.
 * If typeCheckMode === "try", try and run the typecheck. crash if typechecking
 * fails but don't worry if tsc is missing and we can't run it.
 */
export async function typeCheckFunctionsInMode(
  ctx: Context,
  typeCheckMode: TypeCheckMode,
  functionsDir: string,
): Promise<void> {
  if (typeCheckMode === "disable") {
    return;
  }
  await typeCheckFunctions(
    ctx,
    functionsDir,
    async (result, logSpecificError, runOnError) => {
      if (
        (result === "cantTypeCheck" && typeCheckMode === "enable") ||
        result === "typecheckFailed"
      ) {
        logSpecificError?.();
        logError(
          chalk.gray("To ignore failing typecheck, use `--typecheck=disable`."),
        );
        try {
          const result = await runOnError?.();
          // Concurrent change invalidated the error, don't fail
          if (result === "success") {
            return;
          }
        } catch {
          // As expected, `runOnError` threw
        }
        await ctx.crash({
          exitCode: 1,
          errorType: "invalid filesystem data",
          printedMessage: null,
        });
      }
    },
  );
}

// Runs TypeScript compiler to typecheck Convex query and mutation functions.
export async function typeCheckFunctions(
  ctx: Context,
  functionsDir: string,
  handleResult: TypecheckResultHandler,
): Promise<void> {
  const tsconfig = path.join(functionsDir, "tsconfig.json");
  if (!ctx.fs.exists(tsconfig)) {
    return handleResult("cantTypeCheck", () => {
      logError(
        "Found no convex/tsconfig.json to use to typecheck Convex functions, so skipping typecheck.",
      );
      logError("Run `npx convex codegen --init` to create one.");
    });
  }
  await runTsc(ctx, ["--project", functionsDir], handleResult);
}

async function runTsc(
  ctx: Context,
  tscArgs: string[],
  handleResult: TypecheckResultHandler,
): Promise<void> {
  // Check if tsc is even installed
  const tscPath = path.join("node_modules", "typescript", "bin", "tsc");
  if (!ctx.fs.exists(tscPath)) {
    return handleResult("cantTypeCheck", () => {
      logError(
        chalk.gray("No TypeScript binary found, so skipping typecheck."),
      );
    });
  }

  // Check the TypeScript version matches the recommendation from Convex
  const versionResult = await spawnAsync(ctx, process.execPath, [
    tscPath,
    "--version",
  ]);

  const version = versionResult.stdout.match(/Version (.*)/)?.[1] ?? null;
  const hasOlderTypeScriptVersion = version && semver.lt(version, "4.8.4");

  await runTscInner(ctx, tscPath, tscArgs, handleResult);

  // Print this warning after any logs from running `tsc`
  if (hasOlderTypeScriptVersion) {
    logError(
      chalk.yellow(
        "Convex works best with TypeScript version 4.8.4 or newer -- npm i --save-dev typescript@latest to update.",
      ),
    );
  }
}

async function runTscInner(
  ctx: Context,
  tscPath: string,
  tscArgs: string[],
  handleResult: TypecheckResultHandler,
) {
  // Run `tsc` once and have it print out the files it touched. This output won't
  // be very useful if there's an error, but we'll run it again to get a nice
  // user-facing error in this exceptional case.
  // The `--listFiles` command prints out files touched on success or error.
  const result = await spawnAsync(ctx, process.execPath, [
    tscPath,
    ...tscArgs,
    "--listFiles",
  ]);
  if (result.status === null) {
    return handleResult("typecheckFailed", () => {
      logFailure(`TypeScript typecheck timed out.`);
      if (result.error) {
        logError(chalk.red(`${result.error.toString()}`));
      }
    });
  }
  // Okay, we may have failed `tsc` but at least it returned. Try to parse its
  // output to discover which files it touched.
  const filesTouched = result.stdout
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  let anyPathsFound = false;
  for (const fileTouched of filesTouched) {
    const absPath = path.resolve(fileTouched);
    let st;
    try {
      st = ctx.fs.stat(absPath);
      anyPathsFound = true;
    } catch {
      // Just move on if we have a bogus path from `tsc`. We'll log below if
      // we fail to stat *any* of the paths emitted by `tsc`.
      // TODO: Switch to using their JS API so we can get machine readable output.
      continue;
    }
    ctx.fs.registerPath(absPath, st);
  }
  if (filesTouched.length > 0 && !anyPathsFound) {
    const err = new Error(
      `Failed to stat any files emitted by tsc (received ${filesTouched.length})`,
    );
    Sentry.captureException(err);
  }

  if (!result.error && result.status === 0) {
    return handleResult("success");
  }

  // This is the "No inputs were found", which is fine and we shouldn't
  // report it to the user.
  if (result.stdout.startsWith("error TS18003")) {
    return handleResult("success");
  }

  // At this point we know that `tsc` failed. Rerun it without `--listFiles`
  // and with stderr redirected to have it print out a nice error.
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
          stdio: "inherit",
        },
      );
      // If this passes, we had a concurrent file change that'll overlap with
      // our observations in the first run. Invalidate our context's filesystem
      // but allow the rest of the system to observe the success.
      ctx.fs.invalidate();
      return "success";
    },
  );
}
