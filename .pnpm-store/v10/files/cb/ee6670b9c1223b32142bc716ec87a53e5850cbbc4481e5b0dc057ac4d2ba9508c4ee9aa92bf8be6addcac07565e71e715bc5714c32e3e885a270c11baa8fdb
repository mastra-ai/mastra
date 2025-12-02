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
var validate_exports = {};
__export(validate_exports, {
  validateArg: () => validateArg,
  validateArgIsInteger: () => validateArgIsInteger,
  validateArgIsNonNegativeInteger: () => validateArgIsNonNegativeInteger
});
module.exports = __toCommonJS(validate_exports);
function validateArg(arg, idx, method, argName) {
  if (arg === void 0) {
    throw new TypeError(
      `Must provide arg ${idx} \`${argName}\` to \`${method}\``
    );
  }
}
function validateArgIsInteger(arg, idx, method, argName) {
  if (!Number.isInteger(arg)) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be an integer`
    );
  }
}
function validateArgIsNonNegativeInteger(arg, idx, method, argName) {
  if (!Number.isInteger(arg) || arg < 0) {
    throw new TypeError(
      `Arg ${idx} \`${argName}\` to \`${method}\` must be a non-negative integer`
    );
  }
}
//# sourceMappingURL=validate.js.map
