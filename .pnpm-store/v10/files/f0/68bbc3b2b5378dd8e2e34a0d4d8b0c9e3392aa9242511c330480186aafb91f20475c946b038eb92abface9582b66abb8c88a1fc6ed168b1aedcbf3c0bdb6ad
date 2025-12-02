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
var definitionConfig_exports = {};
__export(definitionConfig_exports, {
  appDefinitionConfig: () => appDefinitionConfig,
  componentDefinitionConfig: () => componentDefinitionConfig
});
module.exports = __toCommonJS(definitionConfig_exports);
var import_zod = require("zod");
var import_paths = require("./paths.js");
var import_modules = require("./modules.js");
var import_utils = require("./utils.js");
const appDefinitionConfig = (0, import_utils.looseObject)({
  definition: import_zod.z.nullable(import_modules.moduleConfig),
  dependencies: import_zod.z.array(import_paths.componentDefinitionPath),
  schema: import_zod.z.nullable(import_modules.moduleConfig),
  functions: import_zod.z.array(import_modules.moduleConfig),
  udfServerVersion: import_zod.z.string()
});
const componentDefinitionConfig = (0, import_utils.looseObject)({
  definitionPath: import_paths.componentDefinitionPath,
  definition: import_modules.moduleConfig,
  dependencies: import_zod.z.array(import_paths.componentDefinitionPath),
  schema: import_zod.z.nullable(import_modules.moduleConfig),
  functions: import_zod.z.array(import_modules.moduleConfig),
  udfServerVersion: import_zod.z.string()
});
//# sourceMappingURL=definitionConfig.js.map
