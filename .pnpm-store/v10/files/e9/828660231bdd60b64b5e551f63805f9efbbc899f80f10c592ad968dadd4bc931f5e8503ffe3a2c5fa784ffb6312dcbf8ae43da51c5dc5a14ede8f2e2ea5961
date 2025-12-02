"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var data_exports = {};
__export(data_exports, {
  data: () => data
});
module.exports = __toCommonJS(data_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_extra_typings = require("@commander-js/extra-typings");
var import_command = require("./lib/command.js");
var import_data = require("./lib/data.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const data = new import_extra_typings.Command("data").summary("List tables and print data from your database").description(
  "Inspect your Convex deployment's database.\n\n  List tables: `npx convex data`\n  List documents in a table: `npx convex data tableName`\n\nBy default, this inspects your dev deployment."
).allowExcessArguments(false).addDataOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Inspect the database in")).showHelpAfterError().action(async (tableName, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = deployment.deploymentFields?.deploymentName ? `${import_chalk.default.bold(deployment.deploymentFields.deploymentName)} deployment's ` : "";
  await (0, import_data.dataInDeployment)(ctx, {
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    tableName,
    ...options
  });
});
//# sourceMappingURL=data.js.map
