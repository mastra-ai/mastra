"use strict";
import chalk from "chalk";
import { Command } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { logMessage } from "../bundler/log.js";
import { loadPackageJson } from "./lib/utils/utils.js";
export const update = new Command("update").description("Print instructions for updating the convex package").allowExcessArguments(false).action(async () => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  let updateInstructions = "npm install convex@latest\n";
  const packages = await loadPackageJson(ctx);
  const oldPackageNames = Object.keys(packages).filter(
    (name) => name.startsWith("@convex-dev")
  );
  for (const pkg of oldPackageNames) {
    updateInstructions += `npm uninstall ${pkg}
`;
  }
  logMessage(
    chalk.green(
      `To view the Convex changelog, go to https://news.convex.dev/tag/releases/
When you are ready to upgrade, run the following commands:
${updateInstructions}`
    )
  );
});
//# sourceMappingURL=update.js.map
