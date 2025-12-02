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
var convexExport_exports = {};
__export(convexExport_exports, {
  convexExport: () => convexExport
});
module.exports = __toCommonJS(convexExport_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_chalk = __toESM(require("chalk"), 1);
var import_utils = require("./lib/utils/utils.js");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_dashboard = require("./lib/dashboard.js");
var import_command = require("./lib/command.js");
var import_convexExport = require("./lib/convexExport.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const convexExport = new import_extra_typings.Command("export").summary("Export data from your deployment to a ZIP file").description(
  "Export data, and optionally file storage, from your Convex deployment to a ZIP file.\nBy default, this exports from your dev deployment."
).allowExcessArguments(false).addExportOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Export data from")).showHelpAfterError().action(async (options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "export");
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = options.prod ? ` in your ${import_chalk.default.bold("prod")} deployment` : "";
  await (0, import_convexExport.exportFromDeployment)(ctx, {
    ...options,
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    snapshotExportDashboardLink: (0, import_dashboard.deploymentDashboardUrlPage)(
      deployment.deploymentFields?.deploymentName ?? null,
      "/settings/snapshot-export"
    )
  });
});
//# sourceMappingURL=convexExport.js.map
