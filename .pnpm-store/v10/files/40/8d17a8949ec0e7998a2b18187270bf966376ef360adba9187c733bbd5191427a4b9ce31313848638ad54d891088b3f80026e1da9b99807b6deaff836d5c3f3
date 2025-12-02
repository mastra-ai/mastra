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
var authentication_impl_exports = {};
__export(authentication_impl_exports, {
  setupAuth: () => setupAuth
});
module.exports = __toCommonJS(authentication_impl_exports);
var import_syscall = require("./syscall.js");
function setupAuth(requestId) {
  return {
    getUserIdentity: async () => {
      return await (0, import_syscall.performAsyncSyscall)("1.0/getUserIdentity", {
        requestId
      });
    }
  };
}
//# sourceMappingURL=authentication_impl.js.map
