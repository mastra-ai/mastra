"use client";

// src/primitives/branchPicker/BranchPickerCount.tsx
import { useMessage } from "../../context/react/MessageContext.js";
import { Fragment, jsx } from "react/jsx-runtime";
var useBranchPickerCount = () => {
  const branchCount = useMessage((s) => s.branchCount);
  return branchCount;
};
var BranchPickerPrimitiveCount = () => {
  const branchCount = useBranchPickerCount();
  return /* @__PURE__ */ jsx(Fragment, { children: branchCount });
};
BranchPickerPrimitiveCount.displayName = "BranchPickerPrimitive.Count";
export {
  BranchPickerPrimitiveCount
};
//# sourceMappingURL=BranchPickerCount.js.map