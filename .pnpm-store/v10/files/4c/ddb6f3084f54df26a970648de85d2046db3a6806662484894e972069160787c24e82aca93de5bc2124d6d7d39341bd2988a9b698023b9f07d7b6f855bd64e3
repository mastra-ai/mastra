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
var utils_exports = {};
__export(utils_exports, {
  LOCAL_BACKEND_INSTANCE_SECRET: () => LOCAL_BACKEND_INSTANCE_SECRET,
  choosePorts: () => choosePorts,
  generateInstanceSecret: () => generateInstanceSecret,
  isOffline: () => isOffline,
  printLocalDeploymentWelcomeMessage: () => printLocalDeploymentWelcomeMessage
});
module.exports = __toCommonJS(utils_exports);
var import_log = require("../../../bundler/log.js");
var import_detect_port = require("detect-port");
var import_crypto = __toESM(require("crypto"), 1);
var import_chalk = __toESM(require("chalk"), 1);
async function choosePorts(ctx, {
  count,
  requestedPorts,
  startPort
}) {
  const ports = [];
  for (let i = 0; i < count; i++) {
    const requestedPort = requestedPorts?.[i];
    if (requestedPort !== null) {
      const port = await (0, import_detect_port.detect)(requestedPort);
      if (port !== requestedPort) {
        return ctx.crash({
          exitCode: 1,
          errorType: "fatal",
          printedMessage: "Requested port is not available"
        });
      }
      ports.push(port);
    } else {
      const portToTry = ports.length > 0 ? ports[ports.length - 1] + 1 : startPort;
      const port = await (0, import_detect_port.detect)(portToTry);
      ports.push(port);
    }
  }
  return ports;
}
async function isOffline() {
  return false;
}
function printLocalDeploymentWelcomeMessage() {
  (0, import_log.logMessage)(
    import_chalk.default.cyan("You're trying out the beta local deployment feature!")
  );
  (0, import_log.logMessage)(
    import_chalk.default.cyan(
      "To learn more, read the docs: https://docs.convex.dev/cli/local-deployments"
    )
  );
  (0, import_log.logMessage)(
    import_chalk.default.cyan(
      "To opt out at any time, run `npx convex disable-local-deployments`"
    )
  );
}
function generateInstanceSecret() {
  return import_crypto.default.randomBytes(32).toString("hex");
}
const LOCAL_BACKEND_INSTANCE_SECRET = "4361726e697461732c206c69746572616c6c79206d65616e696e6720226c6974";
//# sourceMappingURL=utils.js.map
