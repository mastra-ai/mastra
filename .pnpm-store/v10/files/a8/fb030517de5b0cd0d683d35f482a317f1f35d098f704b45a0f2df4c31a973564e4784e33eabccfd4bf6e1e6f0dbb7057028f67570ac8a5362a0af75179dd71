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
var actions_impl_exports = {};
__export(actions_impl_exports, {
  setupActionCalls: () => setupActionCalls
});
module.exports = __toCommonJS(actions_impl_exports);
var import_values = require("../../values/index.js");
var import__ = require("../../index.js");
var import_syscall = require("./syscall.js");
var import_common = require("../../common/index.js");
var import_paths = require("../components/paths.js");
function syscallArgs(requestId, functionReference, args) {
  const address = (0, import_paths.getFunctionAddress)(functionReference);
  return {
    ...address,
    args: (0, import_values.convexToJson)((0, import_common.parseArgs)(args)),
    version: import__.version,
    requestId
  };
}
function setupActionCalls(requestId) {
  return {
    runQuery: async (query, args) => {
      const result = await (0, import_syscall.performAsyncSyscall)(
        "1.0/actions/query",
        syscallArgs(requestId, query, args)
      );
      return (0, import_values.jsonToConvex)(result);
    },
    runMutation: async (mutation, args) => {
      const result = await (0, import_syscall.performAsyncSyscall)(
        "1.0/actions/mutation",
        syscallArgs(requestId, mutation, args)
      );
      return (0, import_values.jsonToConvex)(result);
    },
    runAction: async (action, args) => {
      const result = await (0, import_syscall.performAsyncSyscall)(
        "1.0/actions/action",
        syscallArgs(requestId, action, args)
      );
      return (0, import_values.jsonToConvex)(result);
    }
  };
}
//# sourceMappingURL=actions_impl.js.map
