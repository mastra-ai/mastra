import { logMessage } from "../../bundler/log.js";
import { autoUpdateCursorRules } from "./cursorRules.js";
import { getVersion } from "./versionApi.js";

/**
 * Check the version of the `convex` NPM package and automatically update Cursor
 * rules if applicable.
 */
export async function checkVersion() {
  const version = await getVersion();
  if (version === null) {
    return;
  }

  if (version.message) {
    logMessage(version.message);
  }

  if (version.cursorRulesHash) {
    await autoUpdateCursorRules(version.cursorRulesHash);
  }
}
