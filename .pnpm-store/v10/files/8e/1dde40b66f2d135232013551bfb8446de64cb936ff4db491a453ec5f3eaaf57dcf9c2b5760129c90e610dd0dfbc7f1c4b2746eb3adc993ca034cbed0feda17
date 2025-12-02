import {
  createAuthenticateRequest,
  createBackendApiClient,
  verifyToken
} from "./chunk-MQOIIRZU.mjs";
import "./chunk-LWOXHF4E.mjs";
import {
  withLegacyReturn
} from "./chunk-P263NW7Z.mjs";
import "./chunk-2Z4IRG2E.mjs";
import "./chunk-5JS2VYLU.mjs";

// src/index.ts
import { TelemetryCollector } from "@clerk/shared/telemetry";
var verifyToken2 = withLegacyReturn(verifyToken);
function createClerkClient(options) {
  const opts = { ...options };
  const apiClient = createBackendApiClient(opts);
  const requestState = createAuthenticateRequest({ options: opts, apiClient });
  const telemetry = new TelemetryCollector({
    ...options.telemetry,
    publishableKey: opts.publishableKey,
    secretKey: opts.secretKey,
    samplingRate: 0.1,
    ...opts.sdkMetadata ? { sdk: opts.sdkMetadata.name, sdkVersion: opts.sdkMetadata.version } : {}
  });
  return {
    ...apiClient,
    ...requestState,
    telemetry
  };
}
export {
  createClerkClient,
  verifyToken2 as verifyToken
};
//# sourceMappingURL=index.mjs.map