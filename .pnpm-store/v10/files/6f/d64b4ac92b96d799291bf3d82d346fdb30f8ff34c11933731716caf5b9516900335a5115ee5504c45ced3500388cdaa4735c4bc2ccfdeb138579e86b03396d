"use strict";
import { Command, Option } from "@commander-js/extra-typings";
import { oneoffContext } from "../bundler/context.js";
import { runCodegen } from "./lib/components.js";
import { getDeploymentSelection } from "./lib/deploymentSelection.js";
export const codegen = new Command("codegen").summary("Generate backend type definitions").description(
  "Generate code in `convex/_generated/` based on the current contents of `convex/`."
).allowExcessArguments(false).option(
  "--dry-run",
  "Print out the generated configuration to stdout instead of writing to convex directory"
).addOption(new Option("--debug").hideHelp()).addOption(
  new Option(
    "--typecheck <mode>",
    `Whether to check TypeScript files with \`tsc --noEmit\`.`
  ).choices(["enable", "try", "disable"]).default("try")
).option(
  "--init",
  "Also (over-)write the default convex/README.md and convex/tsconfig.json files, otherwise only written when creating a new Convex project."
).addOption(new Option("--admin-key <adminKey>").hideHelp()).addOption(new Option("--url <url>").hideHelp()).addOption(new Option("--live-component-sources").hideHelp()).addOption(
  new Option(
    "--commonjs",
    "Generate CommonJS modules (CJS) instead of ECMAScript modules, the default. Bundlers typically take care of this conversion while bundling, so this setting is generally only useful for projects which do not use a bundler, typically Node.js projects. Convex functions can be written with either syntax."
  ).hideHelp()
).addOption(new Option("--system-udfs").hideHelp()).option(
  "--component-dir <path>",
  "Generate code for a specific component directory instead of the current application."
).action(async (options) => {
  const ctx = await oneoffContext(options);
  const deploymentSelection = await getDeploymentSelection(ctx, options);
  await runCodegen(ctx, deploymentSelection, {
    dryRun: !!options.dryRun,
    debug: !!options.debug,
    typecheck: options.typecheck,
    init: !!options.init,
    commonjs: !!options.commonjs,
    url: options.url,
    adminKey: options.adminKey,
    liveComponentSources: !!options.liveComponentSources,
    debugNodeApis: false,
    systemUdfs: !!options.systemUdfs,
    largeIndexDeletionCheck: "no verification",
    // `codegen` is a read-only operation
    codegenOnlyThisComponent: options.componentDir
  });
});
//# sourceMappingURL=codegen.js.map
