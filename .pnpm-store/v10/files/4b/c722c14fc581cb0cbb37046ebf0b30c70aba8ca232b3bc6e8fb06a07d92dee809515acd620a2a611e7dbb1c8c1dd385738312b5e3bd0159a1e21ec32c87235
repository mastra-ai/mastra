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
var disableLocalDev_exports = {};
__export(disableLocalDev_exports, {
  disableLocalDeployments: () => disableLocalDeployments
});
module.exports = __toCommonJS(disableLocalDev_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_configure = require("./configure.js");
var import_globalConfig = require("./lib/utils/globalConfig.js");
var import_deploymentSelection = require("./lib/deploymentSelection.js");
const disableLocalDeployments = new import_extra_typings.Command("disable-local-deployments").description(
  "Stop using a local deployment for the current project, or globally disable local depoyments with --global"
).option(
  "--global",
  "Disable local deployments on this machine until a future release when this feature is more stable."
).option("--undo-global", "Re-enable local deployments on this machine.").allowExcessArguments(false).action(async (cmdOptions) => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  if (cmdOptions.undoGlobal) {
    return disableLocalDeploymentsGloballyUntilBetaOver(true);
  }
  if (cmdOptions.global) {
    return disableLocalDeploymentsGloballyUntilBetaOver(
      !!cmdOptions.undoGlobal
    );
  }
  const deploymentSelection = await (0, import_deploymentSelection.getDeploymentSelection)(ctx, {
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  const configuredDeployment = (0, import_deploymentSelection.deploymentNameAndTypeFromSelection)(deploymentSelection);
  if (configuredDeployment?.type !== null && configuredDeployment?.type !== "local") {
    (0, import_log.logFinishedStep)("Local development is already not being used.");
    return;
  }
  await (0, import_configure.deploymentCredentialsOrConfigure)(ctx, deploymentSelection, "ask", {
    selectionWithinProject: { kind: "ownDev" },
    prod: false,
    localOptions: {
      forceUpgrade: false
    },
    cloud: true
  });
  (0, import_log.logFinishedStep)(
    "You are no longer using a local deployment for development."
  );
});
async function disableLocalDeploymentsGloballyUntilBetaOver(reenable) {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  if (!process.stdin.isTTY) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "`disable-local-deployments --global` is not for scripting, it is temporary and only for interactive use."
    });
  }
  const config = (0, import_globalConfig.readGlobalConfig)(ctx);
  if (config === null) {
    return ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: "Log in first with `npx convex login"
    });
  }
  if (reenable) {
    if (!("optOutOfLocalDevDeploymentsUntilBetaOver" in config) || !config.optOutOfLocalDevDeploymentsUntilBetaOver) {
      (0, import_log.logFinishedStep)(
        "You are already opted into allowing local deployents on this machine."
      );
      return;
    }
    await (0, import_globalConfig.modifyGlobalConfig)(ctx, {
      ...config,
      optOutOfLocalDevDeploymentsUntilBetaOver: false
    });
    (0, import_log.logFinishedStep)(
      "You have been opted back into allowing local deployents on this machine."
    );
    return;
  }
  if ("optOutOfLocalDevDeploymentsUntilBetaOver" in config && config.optOutOfLocalDevDeploymentsUntilBetaOver) {
    (0, import_log.logFinishedStep)(
      "You are already opted out of local deployents on this machine."
    );
    return;
  }
  await (0, import_globalConfig.modifyGlobalConfig)(ctx, {
    ...config,
    optOutOfLocalDevDeploymentsUntilBetaOver: true
  });
  (0, import_log.logFinishedStep)(
    "You have been opted out of local deployents on this machine until the beta is over. Run `npx convex disable-local-deployments --undo-global` to opt back in."
  );
}
//# sourceMappingURL=disableLocalDev.js.map
