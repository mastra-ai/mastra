"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var requestContext_exports = {};
__export(requestContext_exports, {
  RequestContext: () => RequestContext,
  RequestCrash: () => RequestCrash,
  encodeDeploymentSelector: () => encodeDeploymentSelector
});
module.exports = __toCommonJS(requestContext_exports);
var import_fs = require("../../../bundler/fs.js");
var import_api = require("../api.js");
var import_zod = require("zod");
class RequestContext {
  constructor(options) {
    this.options = options;
    __publicField(this, "fs");
    __publicField(this, "deprecationMessagePrinted", false);
    __publicField(this, "spinner");
    __publicField(this, "_cleanupFns", {});
    __publicField(this, "_bigBrainAuth", null);
    this.fs = import_fs.nodeFs;
    this.deprecationMessagePrinted = false;
  }
  async crash(args) {
    const cleanupFns = this._cleanupFns;
    this._cleanupFns = {};
    for (const fn of Object.values(cleanupFns)) {
      await fn(args.exitCode, args.errForSentry);
    }
    throw new RequestCrash(args.exitCode, args.errorType, args.printedMessage);
  }
  flushAndExit() {
    throw new Error("Not implemented");
  }
  registerCleanup(fn) {
    const handle = crypto.randomUUID();
    this._cleanupFns[handle] = fn;
    return handle;
  }
  removeCleanup(handle) {
    const value = this._cleanupFns[handle];
    delete this._cleanupFns[handle];
    return value ?? null;
  }
  bigBrainAuth() {
    return this._bigBrainAuth;
  }
  _updateBigBrainAuth(auth) {
    this._bigBrainAuth = auth;
  }
  async decodeDeploymentSelector(encoded) {
    const { projectDir, deployment } = decodeDeploymentSelector(encoded);
    if (deployment.kind === "prod" && !this.options.dangerouslyEnableProductionDeployments) {
      return await this.crash({
        exitCode: 1,
        errorType: "fatal",
        printedMessage: "Production deployments are disabled due to the --disable-production-deployments flag."
      });
    }
    return { projectDir, deployment };
  }
  get productionDeploymentsDisabled() {
    return !this.options.dangerouslyEnableProductionDeployments;
  }
}
class RequestCrash {
  constructor(exitCode, errorType, printedMessage) {
    this.exitCode = exitCode;
    this.errorType = errorType;
    __publicField(this, "printedMessage");
    this.printedMessage = printedMessage ?? "Unknown error";
  }
}
function encodeDeploymentSelector(projectDir, deployment) {
  const payload = {
    projectDir,
    deployment
  };
  return `${deployment.kind}:${btoa(JSON.stringify(payload))}`;
}
const payloadSchema = import_zod.z.object({
  projectDir: import_zod.z.string(),
  deployment: import_api.deploymentSelectionWithinProjectSchema
});
function decodeDeploymentSelector(encoded) {
  const [_, serializedPayload] = encoded.split(":");
  return payloadSchema.parse(JSON.parse(atob(serializedPayload)));
}
//# sourceMappingURL=requestContext.js.map
