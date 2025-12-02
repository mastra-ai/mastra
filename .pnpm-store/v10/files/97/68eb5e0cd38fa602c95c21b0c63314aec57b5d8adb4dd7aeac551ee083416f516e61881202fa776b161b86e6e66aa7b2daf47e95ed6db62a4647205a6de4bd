"use client";

// src/primitives/attachment/AttachmentThumb.tsx
import { forwardRef } from "react";
import { useAttachment } from "../../context/react/AttachmentContext.js";
import { Primitive } from "@radix-ui/react-primitive";
import { jsxs } from "react/jsx-runtime";
var AttachmentPrimitiveThumb = forwardRef((props, ref) => {
  const ext = useAttachment((a) => a.name.split(".").pop());
  return /* @__PURE__ */ jsxs(Primitive.div, { ...props, ref, children: [
    ".",
    ext
  ] });
});
AttachmentPrimitiveThumb.displayName = "AttachmentPrimitive.Thumb";
export {
  AttachmentPrimitiveThumb
};
//# sourceMappingURL=AttachmentThumb.js.map