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
var tools_exports = {};
__export(tools_exports, {
  convexTools: () => convexTools,
  mcpTool: () => mcpTool
});
module.exports = __toCommonJS(tools_exports);
var import_zod_to_json_schema = __toESM(require("zod-to-json-schema"), 1);
var import_tables = require("./tables.js");
var import_data = require("./data.js");
var import_status = require("./status.js");
var import_functionSpec = require("./functionSpec.js");
var import_run = require("./run.js");
var import_env = require("./env.js");
var import_runOneoffQuery = require("./runOneoffQuery.js");
var import_logs = require("./logs.js");
function mcpTool(tool) {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: (0, import_zod_to_json_schema.default)(tool.inputSchema)
  };
}
const convexTools = [
  import_status.StatusTool,
  import_data.DataTool,
  import_tables.TablesTool,
  import_functionSpec.FunctionSpecTool,
  import_run.RunTool,
  import_env.EnvListTool,
  import_env.EnvGetTool,
  import_env.EnvSetTool,
  import_env.EnvRemoveTool,
  import_runOneoffQuery.RunOneoffQueryTool,
  import_logs.LogsTool
];
//# sourceMappingURL=index.js.map
