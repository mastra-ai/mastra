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
var syscall_exports = {};
__export(syscall_exports, {
  performAsyncSyscall: () => performAsyncSyscall,
  performJsSyscall: () => performJsSyscall,
  performSyscall: () => performSyscall
});
module.exports = __toCommonJS(syscall_exports);
var import_errors = require("../../values/errors.js");
var import_value = require("../../values/value.js");
function performSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.syscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  const resultStr = Convex.syscall(op, JSON.stringify(arg));
  return JSON.parse(resultStr);
}
async function performAsyncSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.asyncSyscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  let resultStr;
  try {
    resultStr = await Convex.asyncSyscall(op, JSON.stringify(arg));
  } catch (e) {
    if (e.data !== void 0) {
      const rethrown = new import_errors.ConvexError(e.message);
      rethrown.data = (0, import_value.jsonToConvex)(e.data);
      throw rethrown;
    }
    throw new Error(e.message);
  }
  return JSON.parse(resultStr);
}
function performJsSyscall(op, arg) {
  if (typeof Convex === "undefined" || Convex.jsSyscall === void 0) {
    throw new Error(
      "The Convex database and auth objects are being used outside of a Convex backend. Did you mean to use `useQuery` or `useMutation` to call a Convex function?"
    );
  }
  return Convex.jsSyscall(op, arg);
}
//# sourceMappingURL=syscall.js.map
