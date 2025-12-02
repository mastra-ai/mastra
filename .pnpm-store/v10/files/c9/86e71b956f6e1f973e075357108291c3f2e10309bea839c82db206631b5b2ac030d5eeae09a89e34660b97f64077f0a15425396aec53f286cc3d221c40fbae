"use client";

// src/primitives/message/MessageRoot.tsx
import { Primitive } from "@radix-ui/react-primitive";
import {
  forwardRef,
  useCallback
} from "react";
import { useMessageUtilsStore } from "../../context/react/MessageContext.js";
import { useManagedRef } from "../../utils/hooks/useManagedRef.js";
import { useComposedRefs } from "@radix-ui/react-compose-refs";
import { jsx } from "react/jsx-runtime";
var useIsHoveringRef = () => {
  const messageUtilsStore = useMessageUtilsStore();
  const callbackRef = useCallback(
    (el) => {
      const setIsHovering = messageUtilsStore.getState().setIsHovering;
      const handleMouseEnter = () => {
        setIsHovering(true);
      };
      const handleMouseLeave = () => {
        setIsHovering(false);
      };
      el.addEventListener("mouseenter", handleMouseEnter);
      el.addEventListener("mouseleave", handleMouseLeave);
      return () => {
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
        setIsHovering(false);
      };
    },
    [messageUtilsStore]
  );
  return useManagedRef(callbackRef);
};
var MessagePrimitiveRoot = forwardRef((props, forwardRef2) => {
  const isHoveringRef = useIsHoveringRef();
  const ref = useComposedRefs(forwardRef2, isHoveringRef);
  return /* @__PURE__ */ jsx(Primitive.div, { ...props, ref });
});
MessagePrimitiveRoot.displayName = "MessagePrimitive.Root";
export {
  MessagePrimitiveRoot
};
//# sourceMappingURL=MessageRoot.js.map