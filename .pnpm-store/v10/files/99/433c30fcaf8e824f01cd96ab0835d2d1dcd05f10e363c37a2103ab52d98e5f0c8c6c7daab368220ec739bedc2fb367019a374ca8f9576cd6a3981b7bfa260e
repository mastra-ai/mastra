"use client";

// src/primitives/thread/ThreadViewport.tsx
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { Primitive } from "@radix-ui/react-primitive";
import { forwardRef } from "react";
import { useThreadViewportAutoScroll } from "./useThreadViewportAutoScroll.js";
import { ThreadViewportProvider } from "../../context/providers/ThreadViewportProvider.js";
import { jsx } from "react/jsx-runtime";
var ThreadPrimitiveViewportScrollable = forwardRef(({ autoScroll, children, ...rest }, forwardedRef) => {
  const autoScrollRef = useThreadViewportAutoScroll({
    autoScroll
  });
  const ref = useComposedRefs(forwardedRef, autoScrollRef);
  return /* @__PURE__ */ jsx(Primitive.div, { ...rest, ref, children });
});
ThreadPrimitiveViewportScrollable.displayName = "ThreadPrimitive.ViewportScrollable";
var ThreadPrimitiveViewport = forwardRef((props, ref) => {
  return /* @__PURE__ */ jsx(ThreadViewportProvider, { children: /* @__PURE__ */ jsx(ThreadPrimitiveViewportScrollable, { ...props, ref }) });
});
ThreadPrimitiveViewport.displayName = "ThreadPrimitive.Viewport";
export {
  ThreadPrimitiveViewport
};
//# sourceMappingURL=ThreadViewport.js.map