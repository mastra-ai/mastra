"use client";

// src/primitives/error/ErrorMessage.tsx
import { Primitive } from "@radix-ui/react-primitive";
import { forwardRef } from "react";
import { useMessage } from "../../context/react/MessageContext.js";
import { jsx } from "react/jsx-runtime";
var ErrorPrimitiveMessage = forwardRef(({ children, ...props }, forwardRef2) => {
  const error = useMessage((m) => {
    return m.status?.type === "incomplete" && m.status.reason === "error" ? m.status.error : void 0;
  });
  if (error === void 0) return null;
  return /* @__PURE__ */ jsx(Primitive.span, { ...props, ref: forwardRef2, children: children ?? String(error) });
});
ErrorPrimitiveMessage.displayName = "ErrorPrimitive.Message";
export {
  ErrorPrimitiveMessage
};
//# sourceMappingURL=ErrorMessage.js.map