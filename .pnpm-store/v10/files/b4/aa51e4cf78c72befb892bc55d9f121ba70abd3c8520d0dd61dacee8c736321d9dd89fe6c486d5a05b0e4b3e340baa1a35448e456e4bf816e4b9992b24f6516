"use client";

// src/primitives/threadList/ThreadListNew.tsx
import { useAssistantRuntime, useThreadList } from "../../context/index.js";
import { forwardRef } from "react";
import { Primitive } from "@radix-ui/react-primitive";
import { composeEventHandlers } from "@radix-ui/primitive";
import { jsx } from "react/jsx-runtime";
var useThreadListNew = () => {
  const runtime = useAssistantRuntime();
  return () => {
    runtime.switchToNewThread();
  };
};
var ThreadListPrimitiveNew = forwardRef(({ onClick, disabled, ...props }, forwardedRef) => {
  const isMain = useThreadList((t) => t.newThread === t.mainThreadId);
  const callback = useThreadListNew();
  return /* @__PURE__ */ jsx(
    Primitive.button,
    {
      type: "button",
      ...isMain ? { "data-active": "true", "aria-current": "true" } : null,
      ...props,
      ref: forwardedRef,
      disabled: disabled || !callback,
      onClick: composeEventHandlers(onClick, () => {
        callback?.();
      })
    }
  );
});
ThreadListPrimitiveNew.displayName = "ThreadListPrimitive.New";
export {
  ThreadListPrimitiveNew
};
//# sourceMappingURL=ThreadListNew.js.map