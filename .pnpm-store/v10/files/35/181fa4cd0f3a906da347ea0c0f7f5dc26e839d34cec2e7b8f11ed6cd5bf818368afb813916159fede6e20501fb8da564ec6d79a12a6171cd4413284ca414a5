"use client";

// src/primitives/actionBar/ActionBarRoot.tsx
import { Primitive } from "@radix-ui/react-primitive";
import { forwardRef } from "react";
import {
  useActionBarFloatStatus,
  HideAndFloatStatus
} from "./useActionBarFloatStatus.js";
import { jsx } from "react/jsx-runtime";
var ActionBarPrimitiveRoot = forwardRef(({ hideWhenRunning, autohide, autohideFloat, ...rest }, ref) => {
  const hideAndfloatStatus = useActionBarFloatStatus({
    hideWhenRunning,
    autohide,
    autohideFloat
  });
  if (hideAndfloatStatus === HideAndFloatStatus.Hidden) return null;
  return /* @__PURE__ */ jsx(
    Primitive.div,
    {
      ...hideAndfloatStatus === HideAndFloatStatus.Floating ? { "data-floating": "true" } : null,
      ...rest,
      ref
    }
  );
});
ActionBarPrimitiveRoot.displayName = "ActionBarPrimitive.Root";
export {
  ActionBarPrimitiveRoot
};
//# sourceMappingURL=ActionBarRoot.js.map