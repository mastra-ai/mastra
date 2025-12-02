"use client";

// src/primitives/assistantModal/AssistantModalRoot.tsx
import { useEffect, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { usePopoverScope } from "./scope.js";
import { useThreadRuntime } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var useAssistantModalOpenState = ({
  defaultOpen = false,
  unstable_openOnRunStart = true
}) => {
  const state = useState(defaultOpen);
  const [, setOpen] = state;
  const threadRuntime = useThreadRuntime();
  useEffect(() => {
    if (!unstable_openOnRunStart) return void 0;
    return threadRuntime.unstable_on("run-start", () => {
      setOpen(true);
    });
  }, [unstable_openOnRunStart, setOpen, threadRuntime]);
  return state;
};
var AssistantModalPrimitiveRoot = ({
  __scopeAssistantModal,
  defaultOpen,
  unstable_openOnRunStart,
  open,
  onOpenChange,
  ...rest
}) => {
  const scope = usePopoverScope(__scopeAssistantModal);
  const [modalOpen, setOpen] = useAssistantModalOpenState({
    defaultOpen,
    unstable_openOnRunStart
  });
  const openChangeHandler = (open2) => {
    onOpenChange?.(open2);
    setOpen(open2);
  };
  return /* @__PURE__ */ jsx(
    PopoverPrimitive.Root,
    {
      ...scope,
      open: open === void 0 ? modalOpen : open,
      onOpenChange: openChangeHandler,
      ...rest
    }
  );
};
AssistantModalPrimitiveRoot.displayName = "AssistantModalPrimitive.Root";
export {
  AssistantModalPrimitiveRoot
};
//# sourceMappingURL=AssistantModalRoot.js.map