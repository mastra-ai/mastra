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
var import_fs = __toESM(require("fs"));
var import_child_process = require("child_process");
(async () => {
  const { PW_WSL_BRIDGE_PORT: socketPort, ...childEnv } = process.env;
  if (!socketPort)
    throw new Error("PW_WSL_BRIDGE_PORT env var is not set");
  const [executable, ...args] = process.argv.slice(2);
  if (!(await import_fs.default.promises.stat(executable)).isFile())
    throw new Error(`Executable does not exist. Did you update Playwright recently? Make sure to run npx playwright install webkit-wsl`);
  const address = (() => {
    const res = (0, import_child_process.spawnSync)("/usr/bin/wslinfo", ["--networking-mode"], { encoding: "utf8" });
    if (res.error || res.status !== 0)
      throw new Error(`Failed to run /usr/bin/wslinfo --networking-mode: ${res.error?.message || res.stderr || res.status}`);
    if (res.stdout.trim() === "nat") {
      const ipRes = (0, import_child_process.spawnSync)("/usr/sbin/ip", ["route", "show"], { encoding: "utf8" });
      if (ipRes.error || ipRes.status !== 0)
        throw new Error(`Failed to run ip route show: ${ipRes.error?.message || ipRes.stderr || ipRes.status}`);
      const ip = ipRes.stdout.trim().split("\n").find((line) => line.includes("default"))?.split(" ")[2];
      if (!ip)
        throw new Error("Could not determine WSL IP address (NAT mode).");
      return ip;
    }
    return "127.0.0.1";
  })();
  const socket = import_net.default.createConnection(parseInt(socketPort, 10), address);
  socket.setNoDelay(true);
  await new Promise((resolve, reject) => {
    socket.on("connect", resolve);
    socket.on("error", reject);
  });
  const child = (0, import_child_process.spawn)(executable, args, {
    stdio: ["inherit", "inherit", "inherit", "pipe", "pipe"],
    env: childEnv
  });
  const [childOutput, childInput] = [child.stdio[3], child.stdio[4]];
  socket.pipe(childOutput);
  childInput.pipe(socket);
  socket.on("end", () => child.kill());
  child.on("exit", (exitCode) => {
    socket.end();
    process.exit(exitCode || 0);
  });
  await new Promise((resolve, reject) => {
    child.on("exit", resolve);
    child.on("error", reject);
  });
})().catch((error) => {
  console.error("Error occurred:", error);
  process.exit(1);
});
