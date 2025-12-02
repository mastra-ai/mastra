"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
export const reinit = new Command("reinit").description(
  "Reinitialize a Convex project in the local directory if you've lost your convex.json file"
).allowExcessArguments(false).addOption(
  new Option(
    "--team <team_slug>",
    "The identifier of the team the project belongs to."
  )
).addOption(
  new Option(
    "--project <project_slug>",
    "The identifier of the project you'd like to reinitialize."
  )
).action(async (_options) => {
  return (await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  })).crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "The `reinit` command is deprecated. Use `npx convex dev --once --configure=existing` instead.",
    printedMessage: "The `reinit` command is deprecated. Use `npx convex dev --once --configure=existing` instead."
  });
});
//# sourceMappingURL=reinit.js.map
