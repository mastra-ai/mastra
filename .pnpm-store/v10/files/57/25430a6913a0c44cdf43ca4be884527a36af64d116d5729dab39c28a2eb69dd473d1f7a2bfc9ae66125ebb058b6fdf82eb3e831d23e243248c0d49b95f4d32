"use client";

import { createContext } from "react";
import { ReadonlyStore } from "../ReadonlyStore";
import { AttachmentRuntime } from "../../api/AttachmentRuntime";
import { UseBoundStore } from "zustand";
import { createContextHook } from "./utils/createContextHook";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime";

export type AttachmentContextValue = {
  useAttachmentRuntime: UseBoundStore<ReadonlyStore<AttachmentRuntime>>;
};

export const AttachmentContext = createContext<AttachmentContextValue | null>(
  null,
);

const useAttachmentContext = createContextHook(
  AttachmentContext,
  "a ComposerPrimitive.Attachments or MessagePrimitive.Attachments component",
);

export function useAttachmentRuntime(options?: {
  optional?: false | undefined;
}): AttachmentRuntime;
export function useAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime | null;
export function useAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime | null {
  const attachmentRuntime = useAttachmentContext(options);
  if (!attachmentRuntime) return null;
  return attachmentRuntime.useAttachmentRuntime();
}

export function useThreadComposerAttachmentRuntime(options?: {
  optional?: false | undefined;
}): AttachmentRuntime<"thread-composer">;
export function useThreadComposerAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"thread-composer"> | null;
export function useThreadComposerAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"thread-composer"> | null {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "thread-composer")
    throw new Error(
      "This component must be used within a thread's ComposerPrimitive.Attachments component.",
    );
  return attachmentRuntime as AttachmentRuntime<"thread-composer">;
}

export function useEditComposerAttachmentRuntime(options?: {
  optional?: false | undefined;
}): AttachmentRuntime<"edit-composer">;
export function useEditComposerAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"edit-composer"> | null;
export function useEditComposerAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"edit-composer"> | null {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "edit-composer")
    throw new Error(
      "This component must be used within a message's ComposerPrimitive.Attachments component.",
    );

  return attachmentRuntime as AttachmentRuntime<"edit-composer">;
}

export function useMessageAttachmentRuntime(options?: {
  optional?: false | undefined;
}): AttachmentRuntime<"message">;
export function useMessageAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"message"> | null;
export function useMessageAttachmentRuntime(options?: {
  optional?: boolean | undefined;
}): AttachmentRuntime<"message"> | null {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "message")
    throw new Error(
      "This component must be used within a MessagePrimitive.Attachments component.",
    );
  return attachmentRuntime as AttachmentRuntime<"message">;
}

export const useAttachment = createStateHookForRuntime(useAttachmentRuntime);

export const useThreadComposerAttachment = createStateHookForRuntime(
  useThreadComposerAttachmentRuntime,
);
export const useEditComposerAttachment = createStateHookForRuntime(
  useEditComposerAttachmentRuntime,
);
export const useMessageAttachment = createStateHookForRuntime(
  useMessageAttachmentRuntime,
);
