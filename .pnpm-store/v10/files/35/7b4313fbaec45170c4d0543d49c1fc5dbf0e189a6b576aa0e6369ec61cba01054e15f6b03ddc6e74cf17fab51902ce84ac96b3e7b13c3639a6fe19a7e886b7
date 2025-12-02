import chalk from "chalk";
import os from "os";
import path from "path";
import { rootDirectory } from "./utils.js";
import { Context } from "../../../bundler/context.js";
import { logError, logVerbose } from "../../../bundler/log.js";
import { z } from "zod";

export function globalConfigPath(): string {
  return path.join(rootDirectory(), "config.json");
}

// GlobalConfig is stored in a file that very old versions of Convex also need to access.
// Everything besides accessToken must be optional forever.
// GlobalConfig is deleted on logout. It is primarily used for the accessToken.
export type GlobalConfig = {
  accessToken: string;
  // Means "Don't use local dev unless CLI version is at least 1.19" (actual version TBD)
  optOutOfLocalDevDeploymentsUntilBetaOver?: boolean | undefined;
};

const schema = z.object({
  accessToken: z.string().min(1),
  optOutOfLocalDevDeploymentsUntilBetaOver: z.boolean().optional(),
});

export function readGlobalConfig(ctx: Context): GlobalConfig | null {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
  } catch {
    return null;
  }
  try {
    const storedConfig = JSON.parse(configFile);
    const config: GlobalConfig = schema.parse(storedConfig);
    return config;
  } catch (err) {
    // Print an error and act as if the file does not exist.
    logError(
      chalk.red(
        `Failed to parse global config in ${configPath} with error ${
          err as any
        }.`,
      ),
    );
    return null;
  }
}

/** Write the global config, preserving existing properties we don't understand. */
export async function modifyGlobalConfig(ctx: Context, config: GlobalConfig) {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
    // totally fine for it not to exist
    // eslint-disable-next-line no-empty
  } catch {}
  // storedConfig may contain properties this version of the CLI doesn't understand.
  let storedConfig = {};
  if (configFile) {
    try {
      storedConfig = JSON.parse(configFile);
      schema.parse(storedConfig);
    } catch (err) {
      logError(
        chalk.red(
          `Failed to parse global config in ${configPath} with error ${
            err as any
          }.`,
        ),
      );
      storedConfig = {};
    }
  }
  const newConfig: GlobalConfig = { ...storedConfig, ...config };
  await overrwriteGlobalConfig(ctx, newConfig);
}

/** Write global config, overwriting any existing settings. */
async function overrwriteGlobalConfig(ctx: Context, config: GlobalConfig) {
  const dirName = rootDirectory();
  ctx.fs.mkdir(dirName, { allowExisting: true });
  const path = globalConfigPath();
  try {
    ctx.fs.writeUtf8File(path, JSON.stringify(config, null, 2));
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: chalk.red(
        `Failed to write auth config to ${path} with error: ${err as any}`,
      ),
    });
  }
  logVerbose(`Saved credentials to ${formatPathForPrinting(path)}`);
}

export function formatPathForPrinting(path: string) {
  const homedir = os.homedir();
  if (process.platform === "darwin" && path.startsWith(homedir)) {
    return path.replace(homedir, "~");
  }
  return path;
}
