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

// src/logger.ts
var logger_exports = {};
__export(logger_exports, {
  logger: () => logger
});
module.exports = __toCommonJS(logger_exports);
var loggedMessages = /* @__PURE__ */ new Set();
var logger = {
  /**
   * A custom logger that ensures messages are logged only once.
   * Reduces noise and duplicated messages when logs are in a hot codepath.
   */
  warnOnce: (msg) => {
    if (loggedMessages.has(msg)) {
      return;
    }
    loggedMessages.add(msg);
    console.warn(msg);
  },
  logOnce: (msg) => {
    if (loggedMessages.has(msg)) {
      return;
    }
    console.log(msg);
    loggedMessages.add(msg);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  logger
});
//# sourceMappingURL=logger.js.map