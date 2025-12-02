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

// src/buildAccountsBaseUrl.ts
var buildAccountsBaseUrl_exports = {};
__export(buildAccountsBaseUrl_exports, {
  buildAccountsBaseUrl: () => buildAccountsBaseUrl
});
module.exports = __toCommonJS(buildAccountsBaseUrl_exports);
function buildAccountsBaseUrl(frontendApi) {
  if (!frontendApi) {
    return "";
  }
  const accountsBaseUrl = frontendApi.replace(/clerk\.accountsstage\./, "accountsstage.").replace(/clerk\.accounts\.|clerk\./, "accounts.");
  return `https://${accountsBaseUrl}`;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildAccountsBaseUrl
});
//# sourceMappingURL=buildAccountsBaseUrl.js.map