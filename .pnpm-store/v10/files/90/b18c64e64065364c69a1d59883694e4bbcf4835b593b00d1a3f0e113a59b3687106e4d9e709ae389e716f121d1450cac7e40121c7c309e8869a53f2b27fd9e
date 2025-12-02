"use client";

// src/primitives/assistantModal/AssistantModalContent.tsx
import { forwardRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { usePopoverScope } from "./scope.js";
import { composeEventHandlers } from "@radix-ui/primitive";
import { jsx } from "react/jsx-runtime";
var AssistantModalPrimitiveContent = forwardRef(
  ({
    __scopeAssistantModal,
    side,
    align,
    onInteractOutside,
    dissmissOnInteractOutside = false,
    portalProps,
    ...props
  }, forwardedRef) => {
    const scope = usePopoverScope(__scopeAssistantModal);
    return /* @__PURE__ */ jsx(PopoverPrimitive.Portal, { ...scope, ...portalProps, children: /* @__PURE__ */ jsx(
      PopoverPrimitive.Content,
      {
        ...scope,
        ...props,
        ref: forwardedRef,
        side: side ?? "top",
        align: align ?? "end",
        onInteractOutside: composeEventHandlers(
          onInteractOutside,
          dissmissOnInteractOutside ? void 0 : (e) => e.preventDefault()
        )
      }
    ) });
  }
);
AssistantModalPrimitiveContent.displayName = "AssistantModalPrimitive.Content";
export {
  AssistantModalPrimitiveContent
};
//# sourceMappingURL=AssistantModalContent.js.map