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
var auth_exports = {};
__export(auth_exports, {
  auth: () => auth
});
module.exports = __toCommonJS(auth_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
const list = new import_extra_typings.Command("list").action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth list`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
const rm = new import_extra_typings.Command("remove").action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth remove`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
const add = new import_extra_typings.Command("add").addOption(new import_extra_typings.Option("--identity-provider-url <url>").hideHelp()).addOption(new import_extra_typings.Option("--application-id <applicationId>").hideHelp()).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  await ctx.crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "Ran deprecated `convex auth add`",
    printedMessage: "convex auth commands were removed, see https://docs.convex.dev/auth for up to date instructions."
  });
});
const auth = new import_extra_typings.Command("auth").addCommand(list).addCommand(rm).addCommand(add);
//# sourceMappingURL=auth.js.map
