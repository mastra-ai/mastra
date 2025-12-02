"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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
var import_net = __toESM(require("net"));
var import_path = __toESM(require("path"));
var import_child_process = require("child_process");
(async () => {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error(`Usage: node ${import_path.default.basename(__filename)} <executable> [args...]`);
    process.exit(1);
  }
  const parentIn = new import_net.default.Socket({ fd: 3, readable: true, writable: false });
  const parentOut = new import_net.default.Socket({ fd: 4, readable: false, writable: true });
  const server = import_net.default.createServer();
  let socket = null;
  server.on("connection", (s) => {
    if (socket) {
      log("Extra connection received, destroying.");
      socket.destroy();
      return;
    }
    socket = s;
    socket.setNoDelay(true);
    log("Client connected, wiring pipes.");
    socket.pipe(parentOut);
    parentIn.pipe(socket);
    socket.on("close", () => {
      log("Socket closed");
      socket = null;
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, () => resolve(null));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    console.error("Failed to obtain listening address");
    process.exit(1);
  }
  const port = address.port;
  log("Server listening on", port);
  const env = {
    ...process.env,
    // WSLENV is a colon-delimited list of environment variables that should be included when launching WSL processes from Win32 or Win32 processes from WSL
    WSLENV: "PW_WSL_BRIDGE_PORT",
    PW_WSL_BRIDGE_PORT: String(port)
  };
  let shuttingDown = false;
  const child = (0, import_child_process.spawn)("wsl.exe", [
    "-d",
    "playwright",
    "--cd",
    "/home/pwuser",
    "/home/pwuser/node/bin/node",
    "/home/pwuser/webkit-wsl-transport-client.js",
    process.env.WEBKIT_EXECUTABLE || "",
    ...argv
  ], {
    env,
    stdio: ["inherit", "inherit", "inherit"]
    // no fd3/fd4 here; they stay only in this wrapper
  });
  log("Spawned child pid", child.pid);
  child.on("close", (code, signal) => {
    log("Child exit", { code, signal });
    const exitCode = code ?? (signal ? 128 : 0);
    shutdown(exitCode);
  });
  child.on("error", (err) => {
    console.error("Child process failed to start:", err);
    shutdown(1);
  });
  await new Promise((resolve) => child.once("close", resolve));
  async function shutdown(code = 0) {
    if (shuttingDown)
      return;
    shuttingDown = true;
    server.close();
    parentIn.destroy();
    parentOut.destroy();
    socket?.destroy();
    await new Promise((resolve) => server.once("close", resolve));
    process.exit(code);
  }
  function log(...args) {
    console.error(/* @__PURE__ */ new Date(), `[${import_path.default.basename(__filename)}]`, ...args);
  }
})().catch((error) => {
  console.error("Error occurred:", error);
  process.exit(1);
});
