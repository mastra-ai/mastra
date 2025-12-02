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

// src/authorization-errors.ts
var authorization_errors_exports = {};
__export(authorization_errors_exports, {
  isReverificationHint: () => isReverificationHint,
  reverificationError: () => reverificationError,
  reverificationErrorResponse: () => reverificationErrorResponse
});
module.exports = __toCommonJS(authorization_errors_exports);
var REVERIFICATION_REASON = "reverification-error";
var reverificationError = (missingConfig) => ({
  clerk_error: {
    type: "forbidden",
    reason: REVERIFICATION_REASON,
    metadata: {
      reverification: missingConfig
    }
  }
});
var reverificationErrorResponse = (...args) => new Response(JSON.stringify(reverificationError(...args)), {
  status: 403
});
var isReverificationHint = (result) => {
  return result && typeof result === "object" && "clerk_error" in result && result.clerk_error?.type === "forbidden" && result.clerk_error?.reason === REVERIFICATION_REASON;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  isReverificationHint,
  reverificationError,
  reverificationErrorResponse
});
//# sourceMappingURL=authorization-errors.js.map