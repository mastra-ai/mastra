"use client";

// src/primitives/branchPicker/BranchPickerPrevious.tsx
import {
  createActionButton
} from "../../utils/createActionButton.js";
import { useCallback } from "react";
import {
  useMessage,
  useMessageRuntime
} from "../../context/react/MessageContext.js";
var useBranchPickerPrevious = () => {
  const messageRuntime = useMessageRuntime();
  const disabled = useMessage((m) => m.branchNumber <= 1);
  const callback = useCallback(() => {
    messageRuntime.switchToBranch({ position: "previous" });
  }, [messageRuntime]);
  if (disabled) return null;
  return callback;
};
var BranchPickerPrimitivePrevious = createActionButton(
  "BranchPickerPrimitive.Previous",
  useBranchPickerPrevious
);
export {
  BranchPickerPrimitivePrevious
};
//# sourceMappingURL=BranchPickerPrevious.js.map