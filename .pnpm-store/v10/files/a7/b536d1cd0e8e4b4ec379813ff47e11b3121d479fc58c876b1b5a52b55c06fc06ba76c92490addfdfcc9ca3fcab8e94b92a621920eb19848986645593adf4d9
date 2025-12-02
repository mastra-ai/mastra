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
var environmentApi_exports = {};
__export(environmentApi_exports, {
  createCORSOrigin: () => createCORSOrigin,
  createRedirectURI: () => createRedirectURI
});
module.exports = __toCommonJS(environmentApi_exports);
async function createRedirectURI(ctx, apiKey, uri) {
  const response = await fetch(
    "https://api.workos.com/user_management/redirect_uris",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ uri })
    }
  );
  if (!response.ok) {
    if (response.status === 422) {
      const errorText2 = await response.text();
      if (errorText2.includes("already exists")) {
        return { modified: false };
      }
    }
    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create redirect URI: ${response.status} ${errorText}`
    });
  }
  return { modified: true };
}
async function createCORSOrigin(ctx, apiKey, origin) {
  const response = await fetch(
    "https://api.workos.com/user_management/cors_origins",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({ origin })
    }
  );
  if (!response.ok) {
    if (response.status === 409) {
      const errorText2 = await response.text();
      if (errorText2.includes("duplicate_cors_origin") || errorText2.includes("already exists")) {
        return { modified: false };
      }
    }
    const errorText = await response.text();
    return await ctx.crash({
      exitCode: 1,
      errorType: "fatal",
      printedMessage: `Failed to create CORS origin: ${response.status} ${errorText}`
    });
  }
  return { modified: true };
}
//# sourceMappingURL=environmentApi.js.map
