"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var errors_exports = {};
__export(errors_exports, {
  ConvexError: () => ConvexError
});
module.exports = __toCommonJS(errors_exports);
var import_value = require("./value.js");
var _a, _b;
const IDENTIFYING_FIELD = Symbol.for("ConvexError");
class ConvexError extends (_b = Error, _a = IDENTIFYING_FIELD, _b) {
  constructor(data) {
    super(typeof data === "string" ? data : (0, import_value.stringifyValueForError)(data));
    __publicField(this, "name", "ConvexError");
    __publicField(this, "data");
    __publicField(this, _a, true);
    this.data = data;
  }
}
//# sourceMappingURL=errors.js.map
