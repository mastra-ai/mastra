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

// src/ui/base/avatar.tsx
var avatar_exports = {};
__export(avatar_exports, {
  Avatar: () => Avatar,
  AvatarFallback: () => AvatarFallback,
  AvatarImage: () => AvatarImage,
  AvatarRoot: () => AvatarRoot
});
module.exports = __toCommonJS(avatar_exports);
var AvatarPrimitive = __toESM(require("@radix-ui/react-avatar"));
var import_withDefaults = require("../utils/withDefaults.js");
var import_jsx_runtime = require("react/jsx-runtime");
var Avatar = ({ src, alt, fallback }) => {
  if (src == null && fallback == null) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AvatarRoot, { children: [
    src != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AvatarImage, { src, alt }),
    fallback != null && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AvatarFallback, { children: fallback })
  ] });
};
Avatar.displayName = "Avatar";
var AvatarRoot = (0, import_withDefaults.withDefaults)(AvatarPrimitive.Root, {
  className: "aui-avatar-root"
});
AvatarRoot.displayName = "AvatarRoot";
var AvatarImage = (0, import_withDefaults.withDefaults)(AvatarPrimitive.Image, {
  className: "aui-avatar-image"
});
AvatarImage.displayName = "AvatarImage";
var AvatarFallback = (0, import_withDefaults.withDefaults)(AvatarPrimitive.Fallback, {
  className: "aui-avatar-fallback"
});
AvatarFallback.displayName = "AvatarFallback";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarRoot
});
//# sourceMappingURL=avatar.js.map