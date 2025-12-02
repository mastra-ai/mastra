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
var usage_exports = {};
__export(usage_exports, {
  usageStateWarning: () => usageStateWarning
});
module.exports = __toCommonJS(usage_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_log = require("../../bundler/log.js");
var import_dashboard = require("./dashboard.js");
var import_api = require("./api.js");
var import_utils = require("./utils/utils.js");
async function warn(ctx, options) {
  const { title, subtitle, teamSlug } = options;
  (0, import_log.logWarning)(import_chalk.default.bold.yellow(title));
  (0, import_log.logWarning)(import_chalk.default.yellow(subtitle));
  (0, import_log.logWarning)(
    import_chalk.default.yellow(`Visit ${(0, import_dashboard.teamDashboardUrl)(teamSlug)} to learn more.`)
  );
}
async function teamUsageState(ctx, teamId) {
  const { usageState } = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "GET",
    url: "dashboard/teams/" + teamId + "/usage/team_usage_state"
  });
  return usageState;
}
async function teamSpendingLimitsState(ctx, teamId) {
  const response = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "GET",
    url: "dashboard/teams/" + teamId + "/get_spending_limits"
  });
  return response.state;
}
async function usageStateWarning(ctx, targetDeployment) {
  const auth = ctx.bigBrainAuth();
  if (auth === null || auth.kind === "projectKey" || auth.kind === "deploymentKey") {
    return;
  }
  const { teamId, team } = await (0, import_api.fetchTeamAndProject)(ctx, targetDeployment);
  const [usageState, spendingLimitsState] = await Promise.all([
    teamUsageState(ctx, teamId),
    teamSpendingLimitsState(ctx, teamId)
  ]);
  if (spendingLimitsState === "Disabled") {
    await warn(ctx, {
      title: "Your projects are disabled because you exceeded your spending limit.",
      subtitle: "Increase it from the dashboard to re-enable your projects.",
      teamSlug: team
    });
  } else if (usageState === "Approaching") {
    await warn(ctx, {
      title: "Your projects are approaching the Free plan limits.",
      subtitle: "Consider upgrading to avoid service interruption.",
      teamSlug: team
    });
  } else if (usageState === "Exceeded") {
    await warn(ctx, {
      title: "Your projects are above the Free plan limits.",
      subtitle: "Decrease your usage or upgrade to avoid service interruption.",
      teamSlug: team
    });
  } else if (usageState === "Disabled") {
    await warn(ctx, {
      title: "Your projects are disabled because the team exceeded Free plan limits.",
      subtitle: "Decrease your usage or upgrade to reenable your projects.",
      teamSlug: team
    });
  } else if (usageState === "Paused") {
    await warn(ctx, {
      title: "Your projects are disabled because the team previously exceeded Free plan limits.",
      subtitle: "Restore your projects by going to the dashboard.",
      teamSlug: team
    });
  }
}
//# sourceMappingURL=usage.js.map
