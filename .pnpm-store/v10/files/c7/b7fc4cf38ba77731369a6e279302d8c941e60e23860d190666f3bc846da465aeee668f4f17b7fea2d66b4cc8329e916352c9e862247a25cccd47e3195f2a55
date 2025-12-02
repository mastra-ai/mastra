"use client";

import type { FC } from "react";
import { useMessage } from "../../context/react/MessageContext";

const useBranchPickerCount = () => {
  const branchCount = useMessage((s) => s.branchCount);
  return branchCount;
};

export namespace BranchPickerPrimitiveCount {
  /**
   * Props for the BranchPickerPrimitive.Count component.
   * This component takes no props.
   */
  export type Props = Record<string, never>;
}

/**
 * A component that displays the total number of branches for the current message.
 *
 * This component renders the branch count as plain text, useful for showing
 * users how many alternative responses are available.
 *
 * @example
 * ```tsx
 * <div>
 *   Branch <BranchPickerPrimitive.Count /> of {totalBranches}
 * </div>
 * ```
 */
export const BranchPickerPrimitiveCount: FC<
  BranchPickerPrimitiveCount.Props
> = () => {
  const branchCount = useBranchPickerCount();
  return <>{branchCount}</>;
};

BranchPickerPrimitiveCount.displayName = "BranchPickerPrimitive.Count";
