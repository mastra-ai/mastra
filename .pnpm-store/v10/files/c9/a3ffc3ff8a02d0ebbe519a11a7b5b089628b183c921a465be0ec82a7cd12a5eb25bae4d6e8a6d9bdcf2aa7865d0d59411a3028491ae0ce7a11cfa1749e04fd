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
var logs_exports = {};
__export(logs_exports, {
  logs: () => logs
});
module.exports = __toCommonJS(logs_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_command = require("./lib/command.js");
var import_logs = require("./lib/logs.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const logs = new import_extra_typings.Command("logs").summary("Watch logs from your deployment").description(
  "Stream function logs from your Convex deployment.\nBy default, this streams from your project's dev deployment."
).allowExcessArguments(false).addLogsOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Watch logs from")).showHelpAfterError().action(async (cmdOptions) => {
  const ctx = await (0, import_context.oneoffContext)(cmdOptions);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(cmdOptions);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, cmdOptions);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentName = deployment.deploymentFields?.deploymentName ? ` ${deployment.deploymentFields.deploymentName}` : "";
  const deploymentNotice = ` for ${cmdOptions.prod ? "production" : "dev"} deployment${deploymentName}`;
  await (0, import_logs.logsForDeployment)(ctx, deployment, {
    history: cmdOptions.history,
    success: cmdOptions.success,
    jsonl: cmdOptions.jsonl,
    deploymentNotice
  });
});
//# sourceMappingURL=logs.js.map
