"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
const list = new Command("list").action(async () => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth list`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
const rm = new Command("remove").action(async () => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth remove`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
const add = new Command("add").addOption(new Option("--identity-provider-url <url>").hideHelp()).addOption(new Option("--application-id <applicationId>").hideHelp()).action(async () => {
  const ctx = await oneoffContext({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth add`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
export const auth = new Command("auth").addCommand(list).addCommand(rm).addCommand(add);
//# sourceMappingURL=auth.js.map
