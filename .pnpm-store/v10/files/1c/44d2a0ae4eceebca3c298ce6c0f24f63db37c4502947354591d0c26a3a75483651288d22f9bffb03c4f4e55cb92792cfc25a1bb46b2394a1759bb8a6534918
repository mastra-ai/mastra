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
var types_exports = {};
__export(types_exports, {
  authInfo: () => authInfo,
  identifier: () => identifier,
  reference: () => reference
});
module.exports = __toCommonJS(types_exports);
var import_zod = require("zod");
const reference = import_zod.z.string();
const Oidc = import_zod.z.object({
  applicationID: import_zod.z.string(),
  domain: import_zod.z.string()
}).passthrough();
const CustomJwt = import_zod.z.object({
  type: import_zod.z.literal("customJwt"),
  applicationID: import_zod.z.string().nullable(),
  issuer: import_zod.z.string(),
  jwks: import_zod.z.string(),
  algorithm: import_zod.z.string()
}).passthrough();
const authInfo = import_zod.z.union([CustomJwt, Oidc]);
const identifier = import_zod.z.string();
//# sourceMappingURL=types.js.map
