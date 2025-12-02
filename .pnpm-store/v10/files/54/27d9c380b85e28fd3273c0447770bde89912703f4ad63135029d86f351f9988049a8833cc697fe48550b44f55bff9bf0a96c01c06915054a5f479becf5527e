"use client";

// src/primitives/threadListItem/ThreadListItemRoot.tsx
import { Primitive } from "@radix-ui/react-primitive";
import { forwardRef } from "react";
import { useThreadListItem } from "../../context/react/ThreadListItemContext.js";
import { jsx } from "react/jsx-runtime";
var ThreadListItemPrimitiveRoot = forwardRef((props, ref) => {
  const isMain = useThreadListItem((t) => t.isMain);
  return /* @__PURE__ */ jsx(
    Primitive.div,
    {
      ...isMain ? { "data-active": "true", "aria-current": "true" } : null,
      ...props,
      ref
    }
  );
});
ThreadListItemPrimitiveRoot.displayName = "ThreadListItemPrimitive.Root";
export {
  ThreadListItemPrimitiveRoot
};
//# sourceMappingURL=ThreadListItemRoot.js.map