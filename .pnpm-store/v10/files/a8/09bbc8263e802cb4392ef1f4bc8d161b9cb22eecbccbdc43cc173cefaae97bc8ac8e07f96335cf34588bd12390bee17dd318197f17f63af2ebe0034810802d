import * as Sentry from "@sentry/node";
import { downloadLatestCursorRules } from "./versionApi.js";
import path from "path";
import { hashSha256 } from "./utils/hash.js";
import chalk from "chalk";
// In the CLI, we usually want to use the filesystem functions from `Context`
// so that we can detect file changes when watching. However, in this case
// we don’t need to watch the file, and we want to perform filesystem operations
// asynchronously since this is done concurrently with the `dev` command.
// eslint-disable-next-line no-restricted-imports
import { promises as fs } from "fs";
import { logMessage } from "../../bundler/log.js";

/**
 * If the Cursor rules exist and are out of date, update them.
 */
export async function autoUpdateCursorRules(expectedRulesHash: string | null) {
  if (expectedRulesHash === null) {
    return;
  }

  const currentRulesHash = await getCurrentRulesHash();
  if (currentRulesHash === null) {
    return;
  }

  if (currentRulesHash !== expectedRulesHash) {
    const rules = await downloadLatestCursorRules();
    if (rules === null) {
      return;
    }

    try {
      const rulesPath = getRulesPath();
      await fs.writeFile(rulesPath, rules, "utf8");
      logMessage(
        `${chalk.green(`✔`)} Automatically updated the Convex Cursor rules to the latest version.`,
      );
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}

async function getCurrentRulesHash(): Promise<string | null> {
  const rulesPath = getRulesPath();

  let content;
  try {
    content = await fs.readFile(rulesPath, "utf8");
  } catch {
    // Ignore errors if we can’t read the rules file, if the file doesn’t exist we don’t do anything
    return null;
  }

  return hashSha256(content);
}

function getRulesPath(): string {
  return path.join(process.cwd(), ".cursor", "rules", "convex_rules.mdc");
}
