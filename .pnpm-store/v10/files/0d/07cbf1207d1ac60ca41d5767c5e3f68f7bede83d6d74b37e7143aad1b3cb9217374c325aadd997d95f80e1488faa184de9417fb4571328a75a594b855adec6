"use client";

// src/primitives/branchPicker/BranchPickerNext.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import {
  useMessage,
  useMessageRuntime
} from "../../context/react/MessageContext.js";
var useBranchPickerNext = () => {
  const messageRuntime = useMessageRuntime();
  const disabled = useMessage((m) => m.branchNumber >= m.branchCount);
  const callback = useCallback(() => {
    messageRuntime.switchToBranch({ position: "next" });
  }, [messageRuntime]);
  if (disabled) return null;
  return callback;
};
var BranchPickerPrimitiveNext = createActionButton(
  "BranchPickerPrimitive.Next",
  useBranchPickerNext
);
export {
  BranchPickerPrimitiveNext
};
//# sourceMappingURL=BranchPickerNext.js.map