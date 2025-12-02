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
var errors_exports = {};
__export(errors_exports, {
  LocalDeploymentError: () => LocalDeploymentError,
  printLocalDeploymentOnError: () => printLocalDeploymentOnError
});
module.exports = __toCommonJS(errors_exports);
var import_log = require("../../../bundler/log.js");
class LocalDeploymentError extends Error {
}
function printLocalDeploymentOnError() {
  (0, import_log.logFailure)(`Hit an error while running local deployment.`);
  (0, import_log.logMessage)(
    "Your error has been reported to our team, and we'll be working on it. To opt out, run `npx convex disable-local-deployments`. Then re-run your original command."
  );
}
//# sourceMappingURL=errors.js.map
