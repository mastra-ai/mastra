"use strict";
import chalk from "chalk";
import os from "os";
import path from "path";
import { rootDirectory } from "./utils.js";
import { logError, logVerbose } from "../../../bundler/log.js";
import { z } from "zod";
export function globalConfigPath() {
  return path.join(rootDirectory(), "config.json");
}
const schema = z.object({
  accessToken: z.string().min(1),
  optOutOfLocalDevDeploymentsUntilBetaOver: z.boolean().optional()
});
export function readGlobalConfig(ctx) {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
  } catch {
    return null;
  }
  try {
    const storedConfig = JSON.parse(configFile);
    const config = schema.parse(storedConfig);
    return config;
  } catch (err) {
    logError(
      chalk.red(
        `Failed to parse global config in ${configPath} with error ${err}.`
      )
    );
    return null;
  }
}
export async function modifyGlobalConfig(ctx, config) {
  const configPath = globalConfigPath();
  let configFile;
  try {
    configFile = ctx.fs.readUtf8File(configPath);
  } catch {
  }
  let storedConfig = {};
  if (configFile) {
    try {
      storedConfig = JSON.parse(configFile);
      schema.parse(storedConfig);
    } catch (err) {
      logError(
        chalk.red(
          `Failed to parse global config in ${configPath} with error ${err}.`
        )
      );
      storedConfig = {};
    }
  }
  const newConfig = { ...storedConfig, ...config };
  await overrwriteGlobalConfig(ctx, newConfig);
}
async function overrwriteGlobalConfig(ctx, config) {
  const dirName = rootDirectory();
  ctx.fs.mkdir(dirName, { allowExisting: true });
  const path2 = globalConfigPath();
  try {
    ctx.fs.writeUtf8File(path2, JSON.stringify(config, null, 2));
  } catch (err) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "invalid filesystem data",
      errForSentry: err,
      printedMessage: chalk.red(
        `Failed to write auth config to ${path2} with error: ${err}`
      )
    });
  }
  logVerbose(`Saved credentials to ${formatPathForPrinting(path2)}`);
}
export function formatPathForPrinting(path2) {
  const homedir = os.homedir();
  if (process.platform === "darwin" && path2.startsWith(homedir)) {
    return path2.replace(homedir, "~");
  }
  return path2;
}
//# sourceMappingURL=globalConfig.js.map
