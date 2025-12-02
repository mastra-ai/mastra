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

// koa/index.ts
var koa_exports = {};
__export(koa_exports, {
  ironSession: () => ironSession
});
module.exports = __toCommonJS(koa_exports);
var import_iron_session = require("iron-session");

// src/getPropertyDescriptorForReqSession.ts
function getPropertyDescriptorForReqSession(session) {
  return {
    enumerable: true,
    get() {
      return session;
    },
    set(value) {
      const keys = Object.keys(value);
      const currentKeys = Object.keys(session);
      currentKeys.forEach((key) => {
        if (!keys.includes(key)) {
          delete session[key];
        }
      });
      keys.forEach((key) => {
        session[key] = value[key];
      });
    }
  };
}

// koa/index.ts
function ironSession(sessionOptions) {
  return async function ironSessionMiddleWare(ctx, next) {
    const session = await (0, import_iron_session.getIronSession)(ctx.req, ctx.res, sessionOptions);
    Object.defineProperty(
      ctx,
      "session",
      getPropertyDescriptorForReqSession(session)
    );
    await next();
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ironSession
});
//# sourceMappingURL=index.js.map