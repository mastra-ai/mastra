"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import {
  useMessage,
  useMessageRuntime,
} from "../../context/react/MessageContext";

const useBranchPickerNext = () => {
  const messageRuntime = useMessageRuntime();
  const disabled = useMessage((m) => m.branchNumber >= m.branchCount);

  const callback = useCallback(() => {
    messageRuntime.switchToBranch({ position: "next" });
  }, [messageRuntime]);

  if (disabled) return null;
  return callback;
};

export namespace BranchPickerPrimitiveNext {
  export type Element = ActionButtonElement;
  /**
   * Props for the BranchPickerPrimitive.Next component.
   * Inherits all button element props and action button functionality.
   */
  export type Props = ActionButtonProps<typeof useBranchPickerNext>;
}

/**
 * A button component that navigates to the next branch in the message tree.
 *
 * This component automatically handles switching to the next available branch
 * and is disabled when there are no more branches to navigate to.
 *
 * @example
 * ```tsx
 * <BranchPickerPrimitive.Next>
 *   Next →
 * </BranchPickerPrimitive.Next>
 * ```
 */
export const BranchPickerPrimitiveNext = createActionButton(
  "BranchPickerPrimitive.Next",
  useBranchPickerNext,
);
