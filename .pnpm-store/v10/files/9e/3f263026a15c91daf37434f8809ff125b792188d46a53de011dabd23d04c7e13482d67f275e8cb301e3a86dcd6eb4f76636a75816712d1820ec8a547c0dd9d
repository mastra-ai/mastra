import {
  isProductionEnvironment,
  isTestEnvironment
} from "./chunk-7HPDNZ3R.mjs";

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

export {
  deprecated,
  deprecatedProperty,
  deprecatedObjectProperty
};
//# sourceMappingURL=chunk-UEY4AZIP.mjs.map