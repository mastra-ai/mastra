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
var logout_exports = {};
__export(logout_exports, {
  logout: () => logout
});
module.exports = __toCommonJS(logout_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_fsUtils = require("./lib/fsUtils.js");
var import_globalConfig = require("./lib/utils/globalConfig.js");
const logout = new import_extra_typings.Command("logout").description("Log out of Convex on this machine").allowExcessArguments(false).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  if (ctx.fs.exists((0, import_globalConfig.globalConfigPath)())) {
    (0, import_fsUtils.recursivelyDelete)(ctx, (0, import_globalConfig.globalConfigPath)());
  }
  (0, import_log.logFinishedStep)(
    "You have been logged out of Convex.\n  Run `npx convex dev` to log in."
  );
});
//# sourceMappingURL=logout.js.map
