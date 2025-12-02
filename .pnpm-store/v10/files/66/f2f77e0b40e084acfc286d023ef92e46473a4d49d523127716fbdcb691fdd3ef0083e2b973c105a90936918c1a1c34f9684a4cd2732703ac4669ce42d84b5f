"use client";

import { useMessageRuntime } from "./MessageContext";
import { useThreadRuntime } from "./ThreadContext";
import { ComposerRuntime } from "../../api/ComposerRuntime";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";

/**
 * Hook to access the ComposerRuntime from the current context.
 *
 * The ComposerRuntime provides access to composer state and actions for message
 * composition, including text input, attachments, and sending functionality.
 * This hook automatically resolves to either the message's edit composer or
 * the thread's main composer depending on the context.
 *
 * @param options Configuration options
 * @param options.optional Whether the hook should return null if no context is found
 * @returns The ComposerRuntime instance, or null if optional is true and no context exists
 *
 * @example
 * ```tsx
 * function ComposerActions() {
 *   const runtime = useComposerRuntime();
 *
 *   const handleSend = () => {
 *     if (runtime.getState().canSend) {
 *       runtime.send();
 *     }
 *   };
 *
 *   const handleCancel = () => {
 *     if (runtime.getState().canCancel) {
 *       runtime.cancel();
 *     }
 *   };
 *
 *   return (
 *     <div>
 *       <button onClick={handleSend}>Send</button>
 *       <button onClick={handleCancel}>Cancel</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useComposerRuntime(options?: {
  optional?: false | undefined;
}): ComposerRuntime;
export function useComposerRuntime(options?: {
  optional?: boolean | undefined;
}): ComposerRuntime | null;
export function useComposerRuntime(options?: {
  optional?: boolean | undefined;
}): ComposerRuntime | null {
  const messageRuntime = useMessageRuntime({ optional: true });
  const threadRuntime = useThreadRuntime(options);
  return messageRuntime
    ? messageRuntime.composer
    : (threadRuntime?.composer ?? null);
}

/**
 * Hook to access the current composer state.
 *
 * This hook provides reactive access to the composer's state, including text content,
 * attachments, editing status, and send/cancel capabilities.
 *
 * @param selector Optional selector function to pick specific state properties
 * @returns The selected composer state or the entire composer state if no selector provided
 *
 * @example
 * ```tsx
 * function ComposerStatus() {
 *   const text = useComposer((state) => state.text);
 *   const canSend = useComposer((state) => state.canSend);
 *   const attachmentCount = useComposer((state) => state.attachments.length);
 *
 *   return (
 *     <div>
 *       Text: {text.length} chars,
 *       Attachments: {attachmentCount},
 *       Can send: {canSend}
 *     </div>
 *   );
 * }
 * ```
 */
export const useComposer = createStateHookForRuntime(useComposerRuntime);
