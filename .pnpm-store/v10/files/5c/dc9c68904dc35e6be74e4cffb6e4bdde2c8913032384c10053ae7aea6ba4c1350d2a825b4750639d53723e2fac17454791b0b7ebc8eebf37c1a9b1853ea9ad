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
var convexImport_exports = {};
__export(convexImport_exports, {
  convexImport: () => convexImport
});
module.exports = __toCommonJS(convexImport_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_utils = require("./lib/utils/utils.js");
var import_context = require("../bundler/context.js");
var import_api = require("./lib/api.js");
var import_extra_typings = require("@commander-js/extra-typings");
var import_command = require("./lib/command.js");
var import_dashboard = require("./lib/dashboard.js");
var import_convexImport = require("./lib/convexImport.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const convexImport = new import_extra_typings.Command("import").summary("Import data from a file to your deployment").description(
  "Import data from a file to your Convex deployment.\n\n  From a snapshot: `npx convex import snapshot.zip`\n  For a single table: `npx convex import --table tableName file.json`\n\nBy default, this imports into your dev deployment."
).allowExcessArguments(false).addImportOptions().addDeploymentSelectionOptions((0, import_command.actionDescription)("Import data into")).showHelpAfterError().action(async (filePath, options) => {
  const ctx = await (0, import_context.oneoffContext)(options);
  await (0, import_utils.ensureHasConvexDependency)(ctx, "import");
  const selectionWithinProject = (0, import_api.deploymentSelectionWithinProjectFromOptions)(options);
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, options);
  const deployment = await (0, import_api.loadSelectedDeploymentCredentials)(
    ctx,
    deploymentSelection,
    selectionWithinProject
  );
  const deploymentNotice = options.prod ? ` in your ${import_chalk.default.bold("prod")} deployment` : "";
  await (0, import_convexImport.importIntoDeployment)(ctx, filePath, {
    ...options,
    deploymentUrl: deployment.url,
    adminKey: deployment.adminKey,
    deploymentNotice,
    snapshotImportDashboardLink: snapshotImportDashboardLink(
      deployment.deploymentFields?.deploymentName ?? null
    )
  });
});
function snapshotImportDashboardLink(deploymentName) {
  return deploymentName === null ? "https://dashboard.convex.dev/deployment/settings/snapshots" : (0, import_dashboard.deploymentDashboardUrlPage)(deploymentName, "/settings/snapshots");
}
//# sourceMappingURL=convexImport.js.map
