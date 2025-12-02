import chalk from "chalk";
import { functionsDir, ensureHasConvexDependency } from "./lib/utils/utils.js";
import { Command } from "@commander-js/extra-typings";
import { readConfig } from "./lib/config.js";
import { typeCheckFunctions } from "./lib/typecheck.js";
import { oneoffContext } from "../bundler/context.js";
import { logFinishedStep, logMessage } from "../bundler/log.js";

// Experimental (it's going to fail sometimes) TypeScript type checking.
// Includes a separate command to help users debug their TypeScript configs.

export type TypecheckResult = "cantTypeCheck" | "success" | "typecheckFailed";

/** Run the TypeScript compiler, as configured during  */
export const typecheck = new Command("typecheck")
  .description(
    "Run TypeScript typechecking on your Convex functions with `tsc --noEmit`.",
  )
  .allowExcessArguments(false)
  .action(async () => {
    const ctx = await oneoffContext({
      url: undefined,
      adminKey: undefined,
      envFile: undefined,
    });
    const { configPath, config: localConfig } = await readConfig(ctx, false);
    await ensureHasConvexDependency(ctx, "typecheck");
    await typeCheckFunctions(
      ctx,
      functionsDir(configPath, localConfig.projectConfig),
      async (typecheckResult, logSpecificError, runOnError) => {
        logSpecificError?.();
        if (typecheckResult === "typecheckFailed") {
          logMessage(chalk.gray("Typecheck failed"));
          try {
            await runOnError?.();
            // If runOnError doesn't throw then it worked the second time.
            // No errors to report, but it's still a failure.
          } catch {
            // As expected, `runOnError` threw
          }
          return await ctx.crash({
            exitCode: 1,
            errorType: "invalid filesystem data",
            printedMessage: null,
          });
        } else if (typecheckResult === "cantTypeCheck") {
          logMessage(
            chalk.gray("Unable to typecheck; is TypeScript installed?"),
          );
          return await ctx.crash({
            exitCode: 1,
            errorType: "invalid filesystem data",
            printedMessage: null,
          });
        } else {
          logFinishedStep(
            "Typecheck passed: `tsc --noEmit` completed with exit code 0.",
          );
          return await ctx.flushAndExit(0);
        }
      },
    );
  });
