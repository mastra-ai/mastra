// src/ui/base/tooltip-icon-button.tsx
import { forwardRef } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip.mjs";
import { Button } from "./button.mjs";
import { jsx, jsxs } from "react/jsx-runtime";
var TooltipIconButton = forwardRef(({ children, tooltip, side = "bottom", ...rest }, ref) => {
  return /* @__PURE__ */ jsxs(Tooltip, { children: [
    /* @__PURE__ */ jsx(TooltipTrigger, { asChild: true, children: /* @__PURE__ */ jsxs(Button, { variant: "ghost", size: "icon", ...rest, ref, children: [
      children,
      /* @__PURE__ */ jsx("span", { className: "aui-sr-only", children: tooltip })
    ] }) }),
    /* @__PURE__ */ jsx(TooltipContent, { side, children: tooltip })
  ] });
});
TooltipIconButton.displayName = "TooltipIconButton";
export {
  TooltipIconButton
};
//# sourceMappingURL=tooltip-icon-button.mjs.map