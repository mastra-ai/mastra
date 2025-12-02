"use strict";
import * as Sentry from "@sentry/node";
import { downloadLatestCursorRules } from "./versionApi.js";
import path from "path";
import { hashSha256 } from "./utils/hash.js";
import chalk from "chalk";
import { promises as fs } from "fs";
import { logMessage } from "../../bundler/log.js";
export async function autoUpdateCursorRules(expectedRulesHash) {
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
        `${chalk.green(`\u2714`)} Automatically updated the Convex Cursor rules to the latest version.`
      );
    } catch (error) {
      Sentry.captureException(error);
    }
  }
}
async function getCurrentRulesHash() {
  const rulesPath = getRulesPath();
  let content;
  try {
    content = await fs.readFile(rulesPath, "utf8");
  } catch {
    return null;
  }
  return hashSha256(content);
}
function getRulesPath() {
  return path.join(process.cwd(), ".cursor", "rules", "convex_rules.mdc");
}
//# sourceMappingURL=cursorRules.js.map
