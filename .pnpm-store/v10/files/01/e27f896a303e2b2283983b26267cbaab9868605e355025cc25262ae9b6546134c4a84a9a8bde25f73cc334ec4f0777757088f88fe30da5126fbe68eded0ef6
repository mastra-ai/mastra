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

// src/deprecated.ts
var deprecated_exports = {};
__export(deprecated_exports, {
  deprecated: () => deprecated,
  deprecatedObjectProperty: () => deprecatedObjectProperty,
  deprecatedProperty: () => deprecatedProperty
});
module.exports = __toCommonJS(deprecated_exports);

// src/utils/runtimeEnvironment.ts
var isTestEnvironment = () => {
  try {
    return process.env.NODE_ENV === "test";
  } catch {
  }
  return false;
};
var isProductionEnvironment = () => {
  try {
    return process.env.NODE_ENV === "production";
  } catch {
  }
  return false;
};

// src/deprecated.ts
var displayedWarnings = /* @__PURE__ */ new Set();
var deprecated = (fnName, warning, key) => {
  const hideWarning = isTestEnvironment() || isProductionEnvironment();
  const messageId = key ?? fnName;
  if (displayedWarnings.has(messageId) || hideWarning) {
    return;
  }
  displayedWarnings.add(messageId);
  console.warn(
    `Clerk - DEPRECATION WARNING: "${fnName}" is deprecated and will be removed in the next major release.
${warning}`
  );
};
var deprecatedProperty = (cls, propName, warning, isStatic = false) => {
  const target = isStatic ? cls : cls.prototype;
  let value = target[propName];
  Object.defineProperty(target, propName, {
    get() {
      deprecated(propName, warning, `${cls.name}:${propName}`);
      return value;
    },
    set(v) {
      value = v;
    }
  });
};
var deprecatedObjectProperty = (obj, propName, warning, key) => {
  let value = obj[propName];
  Object.defineProperty(obj, propName, {
    get() {
      deprecated(propName, warning, key);
      return value;
    },
    set(v) {
      value = v;
    }
  });
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  deprecated,
  deprecatedObjectProperty,
  deprecatedProperty
});
//# sourceMappingURL=deprecated.js.map