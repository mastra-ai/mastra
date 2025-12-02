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
var bigBrain_exports = {};
__export(bigBrain_exports, {
  bigBrainEnableFeatureMetadata: () => bigBrainEnableFeatureMetadata,
  bigBrainGenerateAdminKeyForAnonymousDeployment: () => bigBrainGenerateAdminKeyForAnonymousDeployment,
  bigBrainPause: () => bigBrainPause,
  bigBrainRecordActivity: () => bigBrainRecordActivity,
  bigBrainStart: () => bigBrainStart,
  projectHasExistingCloudDev: () => projectHasExistingCloudDev
});
module.exports = __toCommonJS(bigBrain_exports);
var import_utils = require("../utils/utils.js");
async function bigBrainStart(ctx, data) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "local_deployment/start",
    data
  });
}
async function bigBrainPause(ctx, data) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "local_deployment/pause",
    data
  });
}
async function bigBrainRecordActivity(ctx, data) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "local_deployment/record_activity",
    data
  });
}
async function bigBrainEnableFeatureMetadata(ctx) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "local_deployment/enable_feature_metadata",
    data: {}
  });
}
async function bigBrainGenerateAdminKeyForAnonymousDeployment(ctx, data) {
  return (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "local_deployment/generate_admin_key",
    data
  });
}
async function projectHasExistingCloudDev(ctx, {
  projectSlug,
  teamSlug
}) {
  const response = await (0, import_utils.bigBrainAPI)({
    ctx,
    method: "POST",
    url: "deployment/existing_dev",
    data: { projectSlug, teamSlug }
  });
  if (response.kind === "Exists") {
    return true;
  } else if (response.kind === "DoesNotExist") {
    return false;
  }
  return await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    printedMessage: `Unexpected /api/deployment/existing_dev response: ${JSON.stringify(response, null, 2)}`
  });
}
//# sourceMappingURL=bigBrain.js.map
