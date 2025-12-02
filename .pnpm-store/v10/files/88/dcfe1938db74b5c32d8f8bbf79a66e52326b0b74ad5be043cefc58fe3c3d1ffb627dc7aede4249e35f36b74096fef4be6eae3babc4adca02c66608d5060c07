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
var run_exports = {};
__export(run_exports, {
  run: () => run
});
module.exports = __toCommonJS(run_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_run = require("./lib/run.js");
var import_utils = require("./lib/utils/utils.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const run = new import_extra_typings.Command("run").description("Run a function (query, mutation, or action) on your deployment").allowExcessArguments(false).addRunOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Run the function on")).showHelpAfterError().action(async (functionName, argsString, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "run");
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  if (deployment.deploymentFields?.deploymentType === "prod" && options.push) {
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `\`convex run\` doesn't support pushing functions to prod deployments. Remove the --push flag. To push to production use \`npx convex deploy\`.`
    });
  }
  await (0, import_run.runInDeployment)(ctx, {
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentName: deployment.deploymentFields?.deploymentName ?? null,
    functionName,
    argsString: argsString ?? "{}",
    componentPath: options.component,
    identityString: options.identity,
    push: !!options.push,
    watch: !!options.watch,
    typecheck: options.typecheck,
    typecheckComponents: options.typecheckComponents,
    codegen: options.codegen === "enable",
    liveComponentSources: !!options.liveComponentSources
  });
});
//# sourceMappingURL=run.js.map
