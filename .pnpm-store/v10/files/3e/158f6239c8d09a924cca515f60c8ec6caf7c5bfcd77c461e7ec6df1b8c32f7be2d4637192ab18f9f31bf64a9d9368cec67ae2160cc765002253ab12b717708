"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var codegen_exports = {};
__export(codegen_exports, {
  codegen: () => codegen
});
module.exports = __toCommonJS(codegen_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_components = require("./lib/components.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const codegen = new import_extra_typings.Command("codegen").summary("Generate backend type definitions").description(
  "Generate code in `convex/_generated/` based on the current contents of `convex/`."
).allowExcessArguments(false).option(
  "--dry-run",
  "Print out the generated configuration to stdout instead of writing to convex directory"
).addOption(new import_extra_typings.Option("--debug").hideHelp()).addOption(
  new import_extra_typings.Option(
    "--typecheck <mode>",
    `Whether to check TypeScript files with \`tsc --noEmit\`.`
  ).choices(["enable", "try", "disable"]).default("try")
).option(
  "--init",
  "Also (over-)write the default convex/README.md and convex/tsconfig.json files, otherwise only written when creating a new Convex project."
).addOption(new import_extra_typings.Option("--admin-key <adminKey>").hideHelp()).addOption(new import_extra_typings.Option("--url <url>").hideHelp()).addOption(new import_extra_typings.Option("--live-component-sources").hideHelp()).addOption(
  new import_extra_typings.Option(
    "--commonjs",
    "Generate CommonJS modules (CJS) instead of ECMAScript modules, the default. Bundlers typically take care of this conversion while bundling, so this setting is generally only useful for projects which do not use a bundler, typically Node.js projects. Convex functions can be written with either syntax."
  ).hideHelp()
).addOption(new import_extra_typings.Option("--system-udfs").hideHelp()).option(
  "--component-dir <path>",
  "Generate code for a specific component directory instead of the current application."
).action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  await (0, import_components.runCodegen)(ctx, deploymentSelection, {
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
