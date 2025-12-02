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

// src/ui/base/button.tsx
var button_exports = {};
__export(button_exports, {
  Button: () => Button,
  buttonVariants: () => buttonVariants
});
module.exports = __toCommonJS(button_exports);
var import_class_variance_authority = require("class-variance-authority");
var import_react_primitive = require("@radix-ui/react-primitive");
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var buttonVariants = (0, import_class_variance_authority.cva)("aui-button", {
  variants: {
    variant: {
      default: "aui-button-primary",
      outline: "aui-button-outline",
      ghost: "aui-button-ghost"
    },
    size: {
      default: "aui-button-medium",
      icon: "aui-button-icon"
    }
  },
  defaultVariants: {
    variant: "default",
    size: "default"
  }
});
var Button = (0, import_react.forwardRef)(
  ({ className, variant, size, ...props }, ref) => {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_react_primitive.Primitive.button,
      {
        className: buttonVariants({ variant, size, className }),
        ...props,
        ref
      }
    );
  }
);
Button.displayName = "Button";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  Button,
  buttonVariants
});
//# sourceMappingURL=button.js.map