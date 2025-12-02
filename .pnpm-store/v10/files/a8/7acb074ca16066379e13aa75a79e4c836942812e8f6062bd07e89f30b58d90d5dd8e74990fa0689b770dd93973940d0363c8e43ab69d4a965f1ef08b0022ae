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
var update_exports = {};
__export(update_exports, {
  update: () => update
});
module.exports = __toCommonJS(update_exports);
var import_chalk = __toESM(require("chalk"), 1);
var import_extra_typings = require("@commander-js/extra-typings");
var import_context = require("../bundler/context.js");
var import_log = require("../bundler/log.js");
var import_utils = require("./lib/utils/utils.js");
const update = new import_extra_typings.Command("update").description("Print instructions for updating the convex package").allowExcessArguments(false).action(async () => {
  const ctx = await (0, import_context.oneoffContext)({
    url: void 0,
    adminKey: void 0,
    envFile: void 0
  });
  let updateInstructions = "npm install convex@latest\n";
  const packages = await (0, import_utils.loadPackageJson)(ctx);
  const oldPackageNames = Object.keys(packages).filter(
    (name) => name.startsWith("@convex-dev")
  );
  for (const pkg of oldPackageNames) {
    updateInstructions += `npm uninstall ${pkg}
`;
  }
  (0, import_log.logMessage)(
    import_chalk.default.green(
      `To view the Convex changelog, go to https://news.convex.dev/tag/releases/
When you are ready to upgrade, run the following commands:
${updateInstructions}`
    )
  );
});
//# sourceMappingURL=update.js.map
