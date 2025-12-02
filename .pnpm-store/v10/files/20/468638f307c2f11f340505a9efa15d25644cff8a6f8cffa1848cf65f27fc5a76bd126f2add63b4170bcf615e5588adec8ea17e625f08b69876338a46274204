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
var init_exports = {};
__export(init_exports, {
  init: () => init
});
module.exports = __toCommonJS(init_exports);
var import_extra_typings = require("@commander-js/extra-typings");
var import_path = __toESM(require("path"), 1);
var import_context = require("../bundler/context.js");
const cwd = import_path.default.basename(process.cwd());
const init = new import_extra_typings.Command("init").description("Initialize a new Convex project in the current directory").allowExcessArguments(false).addOption(
  new import_extra_typings.Option(
    "--project <name>",
    `Name of the project to create. Defaults to \`${cwd}\` (the current directory)`
  )
).addOption(
  new import_extra_typings.Option(
    "--team <slug>",
    "Slug identifier for the team this project will belong to."
  )
).action(async (_options) => {
  return (await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  })).crash({
    exitCode: 1,
    errorType: "fatal",
    errForSentry: "The `init` command is deprecated. Use `npx convex dev --once --configure=new` instead.",
    printedMessage: "The `init` command is deprecated. Use `npx convex dev --once --configure=new` instead."
  });
});
//# sourceMappingURL=init.js.map
