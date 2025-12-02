"use client";

// src/primitives/messagePart/MessagePartText.tsx
import {
  forwardRef
} from "react";
import { useMessagePartText } from "./useMessagePartText.js";
import { useSmooth } from "../../utils/smooth/useSmooth.js";
import { jsx } from "react/jsx-runtime";
var MessagePartPrimitiveText = forwardRef(({ smooth = true, component: Component = "span", ...rest }, forwardedRef) => {
  const { text, status } = useSmooth(useMessagePartText(), smooth);
  return /* @__PURE__ */ jsx(Component, { "data-status": status.type, ...rest, ref: forwardedRef, children: text });
});
MessagePartPrimitiveText.displayName = "MessagePartPrimitive.Text";
export {
  MessagePartPrimitiveText
};
//# sourceMappingURL=MessagePartText.js.map