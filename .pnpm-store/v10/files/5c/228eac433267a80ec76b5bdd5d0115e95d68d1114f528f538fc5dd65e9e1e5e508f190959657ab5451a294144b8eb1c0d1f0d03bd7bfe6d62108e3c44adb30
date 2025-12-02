"use client";

import type { FC } from "react";
import { useMessage } from "../../context/react/MessageContext";

const useBranchPickerNumber = () => {
  const branchNumber = useMessage((s) => s.branchNumber);
  return branchNumber;
};

export namespace BranchPickerPrimitiveNumber {
  export type Props = Record<string, never>;
}

export const BranchPickerPrimitiveNumber: FC<
  BranchPickerPrimitiveNumber.Props
> = () => {
  const branchNumber = useBranchPickerNumber();
  return <>{branchNumber}</>;
};

BranchPickerPrimitiveNumber.displayName = "BranchPickerPrimitive.Number";
