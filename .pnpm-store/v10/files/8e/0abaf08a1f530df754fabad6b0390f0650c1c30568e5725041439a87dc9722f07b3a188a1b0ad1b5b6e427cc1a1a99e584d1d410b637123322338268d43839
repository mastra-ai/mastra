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

// src/cookie.ts
var cookie_exports = {};
__export(cookie_exports, {
  createCookieHandler: () => createCookieHandler
});
module.exports = __toCommonJS(cookie_exports);
var import_js_cookie = __toESM(require("js-cookie"));
function createCookieHandler(cookieName) {
  return {
    get() {
      return import_js_cookie.default.get(cookieName);
    },
    /**
     * Setting a cookie will use some defaults such as path being set to "/".
     */
    set(newValue, options = {}) {
      import_js_cookie.default.set(cookieName, newValue, options);
    },
    /**
     * On removing a cookie, you have to pass the exact same path/domain attributes used to set it initially
     * > IMPORTANT! When deleting a cookie and you're not relying on the default attributes, you must pass the exact same path, domain, secure and sameSite attributes that were used to set the cookie.
     *
     * @see https://github.com/js-cookie/js-cookie#basic-usage
     */
    remove(cookieAttributes) {
      import_js_cookie.default.remove(cookieName, cookieAttributes);
    }
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createCookieHandler
});
//# sourceMappingURL=cookie.js.map