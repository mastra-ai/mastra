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
var functionSpec_exports = {};
__export(functionSpec_exports, {
  functionSpec: () => functionSpec
});
module.exports = __toCommonJS(functionSpec_exports);
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_extra_typings = require("@commander-js/extra-typings");
var import_command = require("./lib/command.js");
var import_functionSpec = require("./lib/functionSpec.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const functionSpec = new import_extra_typings.Command("function-spec").summary("List function metadata from your deployment").description(
  "List argument and return values to your Convex functions.\n\nBy default, this inspects your dev deployment."
).allowExcessArguments(false).addOption(new import_extra_typings.Option("--file", "Output as JSON to a file.")).addDeploymentSelectionOptions(
  (0, import_command.actionDescription)("Read function metadata from")
).showHelpAfterError().action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const { adminKey, url: deploymentUrl } = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  await (0, import_functionSpec.functionSpecForDeployment)(ctx, {
    deploymentUrl,
    adminKey,
    file: !!options.file
  });
});
//# sourceMappingURL=functionSpec.js.map
