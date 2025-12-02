"use client";

import {
  ActionButtonElement,
  ActionButtonProps,
  createActionButton,
} from "../../utils/createActionButton";
import { useCallback } from "react";
import { useMessageRuntime } from "../../context";
import { useThreadRuntime } from "../../context/react/ThreadContext";
import { useCombinedStore } from "../../utils/combined/useCombinedStore";

/**
 * Hook that provides reload functionality for action bar buttons.
 *
 * This hook returns a callback function that reloads/regenerates the current assistant message,
 * or null if reloading is not available (e.g., thread is running, disabled, or message is not from assistant).
 *
 * @returns A reload callback function, or null if reloading is disabled
 *
 * @example
 * ```tsx
 * function CustomReloadButton() {
 *   const reload = useActionBarReload();
 *
 *   return (
 *     <button onClick={reload} disabled={!reload}>
 *       {reload ? "Reload Message" : "Cannot Reload"}
 *     </button>
 *   );
 * }
 * ```
 */
const useActionBarReload = () => {
  const messageRuntime = useMessageRuntime();
  const threadRuntime = useThreadRuntime();

  const disabled = useCombinedStore(
    [threadRuntime, messageRuntime],
    (t, m) => t.isRunning || t.isDisabled || m.role !== "assistant",
  );

  const callback = useCallback(() => {
    messageRuntime.reload();
  }, [messageRuntime]);

  if (disabled) return null;
  return callback;
};

export namespace ActionBarPrimitiveReload {
  export type Element = ActionButtonElement;
  /**
   * Props for the ActionBarPrimitive.Reload component.
   * Inherits all button element props and action button functionality.
   */
  export type Props = ActionButtonProps<typeof useActionBarReload>;
}

/**
 * A button component that reloads/regenerates the current assistant message.
 *
 * This component automatically handles reloading the current assistant message
 * and is disabled when reloading is not available (e.g., thread is running,
 * disabled, or message is not from assistant).
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Reload>
 *   Reload Message
 * </ActionBarPrimitive.Reload>
 * ```
 */
export const ActionBarPrimitiveReload = createActionButton(
  "ActionBarPrimitive.Reload",
  useActionBarReload,
);
