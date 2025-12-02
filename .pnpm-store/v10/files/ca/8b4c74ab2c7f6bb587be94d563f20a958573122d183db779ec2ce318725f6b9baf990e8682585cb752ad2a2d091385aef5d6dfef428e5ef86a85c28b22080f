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
var reinit_exports = {};
__export(reinit_exports, {
  reinit: () => reinit
});
module.exports = __toCommonJS(reinit_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
const reinit = new import_extra_typings.Command("reinit").description(
  "Reinitialize a Convex project in the local directory if you've lost your convex.json file"
).allowExcessArguments(false).addOption(
  new import_extra_typings.Option(
    "--team <team_slug>",
    "The identifier of the team the project belongs to."
  )
).addOption(
  new import_extra_typings.Option(
    "--project <project_slug>",
    "The identifier of the project you'd like to reinitialize."
  )
).action(async (_options) => {
  return (await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  })).crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "The `reinit` command is deprecated. Use `npx convex dev --once --configure=existing` instead.",
    printedMessage: "The `reinit` command is deprecated. Use `npx convex dev --once --configure=existing` instead."
  });
});
//# sourceMappingURL=reinit.js.map
