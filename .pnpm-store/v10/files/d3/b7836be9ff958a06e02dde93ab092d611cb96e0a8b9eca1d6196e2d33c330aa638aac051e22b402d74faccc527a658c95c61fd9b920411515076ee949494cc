"use client";

// src/primitives/branchPicker/BranchPickerNumber.tsx
import { useMessage } from "../../context/react/MessageContext.js";
import { Fragment, jsx } from "react/jsx-runtime";
var useBranchPickerNumber = () => {
  const branchNumber = useMessage((s) => s.branchNumber);
  return branchNumber;
};
var BranchPickerPrimitiveNumber = () => {
  const branchNumber = useBranchPickerNumber();
  return /* @__PURE__ */ jsx(Fragment, { children: branchNumber });
};
BranchPickerPrimitiveNumber.displayName = "BranchPickerPrimitive.Number";
export {
  BranchPickerPrimitiveNumber
};
//# sourceMappingURL=BranchPickerNumber.js.map