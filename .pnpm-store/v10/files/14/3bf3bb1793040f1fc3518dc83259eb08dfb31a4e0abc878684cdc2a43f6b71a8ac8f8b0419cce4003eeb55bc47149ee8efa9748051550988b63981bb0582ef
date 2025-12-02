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
var middleware_exports = {};
__export(middleware_exports, {
  next: () => next,
  rewrite: () => rewrite
});
module.exports = __toCommonJS(middleware_exports);
function handleMiddlewareField(init, headers) {
  if (init?.request?.headers) {
    if (!(init.request.headers instanceof Headers)) {
      throw new Error("request.headers must be an instance of Headers");
    }
    const keys = [];
    for (const [key, value] of init.request.headers) {
      headers.set("x-middleware-request-" + key, value);
      keys.push(key);
    }
    headers.set("x-middleware-override-headers", keys.join(","));
  }
}
function rewrite(destination, init) {
  const headers = new Headers(init?.headers ?? {});
  headers.set("x-middleware-rewrite", String(destination));
  handleMiddlewareField(init, headers);
  return new Response(null, {
    ...init,
    headers
  });
}
function next(init) {
  const headers = new Headers(init?.headers ?? {});
  headers.set("x-middleware-next", "1");
  handleMiddlewareField(init, headers);
  return new Response(null, {
    ...init,
    headers
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  next,
  rewrite
});
