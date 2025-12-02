"use strict";
import { bigBrainAPI } from "../utils/utils.js";
export async function bigBrainStart(ctx, data) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "local_deployment/start",
    data
  });
}
export async function bigBrainPause(ctx, data) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "local_deployment/pause",
    data
  });
}
export async function bigBrainRecordActivity(ctx, data) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "local_deployment/record_activity",
    data
  });
}
export async function bigBrainEnableFeatureMetadata(ctx) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "local_deployment/enable_feature_metadata",
    data: {}
  });
}
export async function bigBrainGenerateAdminKeyForAnonymousDeployment(ctx, data) {
  return bigBrainAPI({
    ctx,
    method: "POST",
    url: "local_deployment/generate_admin_key",
    data
  });
}
export async function projectHasExistingCloudDev(ctx, {
  projectSlug,
  teamSlug
}) {
  const response = await bigBrainAPI({
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
