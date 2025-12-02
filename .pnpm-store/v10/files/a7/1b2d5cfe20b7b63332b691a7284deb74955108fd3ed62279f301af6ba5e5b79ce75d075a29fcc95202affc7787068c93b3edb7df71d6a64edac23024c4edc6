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

// src/alternativePhoneCode.ts
var alternativePhoneCode_exports = {};
__export(alternativePhoneCode_exports, {
  ALTERNATIVE_PHONE_CODE_PROVIDERS: () => ALTERNATIVE_PHONE_CODE_PROVIDERS,
  getAlternativePhoneCodeProviderData: () => getAlternativePhoneCodeProviderData
});
module.exports = __toCommonJS(alternativePhoneCode_exports);
var ALTERNATIVE_PHONE_CODE_PROVIDERS = [
  {
    channel: "whatsapp",
    name: "WhatsApp"
  }
];
var getAlternativePhoneCodeProviderData = (channel) => {
  if (!channel) {
    return null;
  }
  return ALTERNATIVE_PHONE_CODE_PROVIDERS.find((p) => p.channel === channel) || null;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ALTERNATIVE_PHONE_CODE_PROVIDERS,
  getAlternativePhoneCodeProviderData
});
//# sourceMappingURL=alternativePhoneCode.js.map