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

// src/ui/base/tooltip-icon-button.tsx
var tooltip_icon_button_exports = {};
__export(tooltip_icon_button_exports, {
  TooltipIconButton: () => TooltipIconButton
});
module.exports = __toCommonJS(tooltip_icon_button_exports);
var import_react = require("react");
var import_tooltip = require("./tooltip.js");
var import_button = require("./button.js");
var import_jsx_runtime = require("react/jsx-runtime");
var TooltipIconButton = (0, import_react.forwardRef)(({ children, tooltip, side = "bottom", ...rest }, ref) => {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_tooltip.Tooltip, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_tooltip.TooltipTrigger, { asChild: true, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_button.Button, { variant: "ghost", size: "icon", ...rest, ref, children: [
      children,
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "aui-sr-only", children: tooltip })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_tooltip.TooltipContent, { side, children: tooltip })
  ] });
});
TooltipIconButton.displayName = "TooltipIconButton";
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TooltipIconButton
});
//# sourceMappingURL=tooltip-icon-button.js.map