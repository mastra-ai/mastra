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
var auth_helpers_exports = {};
__export(auth_helpers_exports, {
  AuthLoading: () => AuthLoading,
  Authenticated: () => Authenticated,
  Unauthenticated: () => Unauthenticated
});
module.exports = __toCommonJS(auth_helpers_exports);
var import_react = __toESM(require("react"), 1);
var import_ConvexAuthState = require("./ConvexAuthState.js");
function Authenticated({ children }) {
  const { isLoading, isAuthenticated } = (0, import_ConvexAuthState.useConvexAuth)();
  if (isLoading || !isAuthenticated) {
    return null;
  }
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, children);
}
function Unauthenticated({ children }) {
  const { isLoading, isAuthenticated } = (0, import_ConvexAuthState.useConvexAuth)();
  if (isLoading || isAuthenticated) {
    return null;
  }
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, children);
}
function AuthLoading({ children }) {
  const { isLoading } = (0, import_ConvexAuthState.useConvexAuth)();
  if (!isLoading) {
    return null;
  }
  return /* @__PURE__ */ import_react.default.createElement(import_react.default.Fragment, null, children);
}
//# sourceMappingURL=auth_helpers.js.map
