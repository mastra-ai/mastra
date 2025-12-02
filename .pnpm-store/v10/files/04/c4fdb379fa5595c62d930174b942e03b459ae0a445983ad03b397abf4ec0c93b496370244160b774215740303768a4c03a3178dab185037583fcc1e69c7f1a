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
var serve_exports = {};
__export(serve_exports, {
  startServer: () => startServer
});
module.exports = __toCommonJS(serve_exports);
var import_node_http = __toESM(require("node:http"), 1);
var import_log = require("../../../bundler/log.js");
const startServer = async (ctx, port, handler, options) => {
  const serverHandler = (request, response) => {
    const run = async () => {
      if (options.cors) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Access-Control-Allow-Headers", "*");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setHeader("Access-Control-Allow-Private-Network", "true");
      }
      await handler(request, response);
    };
    run().catch((error) => {
      (0, import_log.logVerbose)(
        `Failed to serve: ${error.stack?.toString() ?? error.message}`
      );
    });
  };
  const server = import_node_http.default.createServer(serverHandler);
  const cleanupHandle = ctx.registerCleanup(async () => {
    (0, import_log.logVerbose)(`Stopping server on port ${port}`);
    await server.close();
  });
  server.on("error", (error) => {
    (0, import_log.logVerbose)(`Failed to serve: ${error.stack?.toString() ?? error.message}`);
  });
  await new Promise((resolve, _reject) => {
    server.listen(port, `127.0.0.1`, () => resolve(`http://127.0.0.1:${port}`));
  });
  return { cleanupHandle };
};
//# sourceMappingURL=serve.js.map
