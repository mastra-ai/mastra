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

// src/ui/utils/withDefaults.tsx
var withDefaults_exports = {};
__export(withDefaults_exports, {
  withDefaultProps: () => withDefaultProps,
  withDefaults: () => withDefaults
});
module.exports = __toCommonJS(withDefaults_exports);
var import_react = require("react");
var import_classnames = __toESM(require("classnames"));
var import_jsx_runtime = require("react/jsx-runtime");
var withDefaultProps = ({
  className,
  ...defaultProps
}) => ({ className: classNameProp, ...props }) => {
  return {
    className: (0, import_classnames.default)(className, classNameProp),
    ...defaultProps,
    ...props
  };
};
var withDefaults = (Component, defaultProps) => {
  const getProps = withDefaultProps(defaultProps);
  const WithDefaults = (0, import_react.forwardRef)(
    (props, ref) => {
      const ComponentAsAny = Component;
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ComponentAsAny, { ...getProps(props), ref });
    }
  );
  WithDefaults.displayName = "withDefaults(" + (typeof Component === "string" ? Component : Component.displayName) + ")";
  return WithDefaults;
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  withDefaultProps,
  withDefaults
});
//# sourceMappingURL=withDefaults.js.map