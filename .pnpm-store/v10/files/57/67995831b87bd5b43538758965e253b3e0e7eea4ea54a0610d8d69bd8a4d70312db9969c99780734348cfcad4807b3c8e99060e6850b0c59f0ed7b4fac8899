"use client";

// src/context/react/AttachmentContext.ts
import { createContext } from "react";
import { createContextHook } from "./utils/createContextHook.js";
import { createStateHookForRuntime } from "./utils/createStateHookForRuntime.js";
var AttachmentContext = createContext(
  null
);
var useAttachmentContext = createContextHook(
  AttachmentContext,
  "a ComposerPrimitive.Attachments or MessagePrimitive.Attachments component"
);
function useAttachmentRuntime(options) {
  const attachmentRuntime = useAttachmentContext(options);
  if (!attachmentRuntime) return null;
  return attachmentRuntime.useAttachmentRuntime();
}
function useThreadComposerAttachmentRuntime(options) {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "thread-composer")
    throw new Error(
      "This component must be used within a thread's ComposerPrimitive.Attachments component."
    );
  return attachmentRuntime;
}
function useEditComposerAttachmentRuntime(options) {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "edit-composer")
    throw new Error(
      "This component must be used within a message's ComposerPrimitive.Attachments component."
    );
  return attachmentRuntime;
}
function useMessageAttachmentRuntime(options) {
  const attachmentRuntime = useAttachmentRuntime(options);
  if (!attachmentRuntime) return null;
  if (attachmentRuntime.source !== "message")
    throw new Error(
      "This component must be used within a MessagePrimitive.Attachments component."
    );
  return attachmentRuntime;
}
var useAttachment = createStateHookForRuntime(useAttachmentRuntime);
var useThreadComposerAttachment = createStateHookForRuntime(
  useThreadComposerAttachmentRuntime
);
var useEditComposerAttachment = createStateHookForRuntime(
  useEditComposerAttachmentRuntime
);
var useMessageAttachment = createStateHookForRuntime(
  useMessageAttachmentRuntime
);
export {
  AttachmentContext,
  useAttachment,
  useAttachmentRuntime,
  useEditComposerAttachment,
  useEditComposerAttachmentRuntime,
  useMessageAttachment,
  useMessageAttachmentRuntime,
  useThreadComposerAttachment,
  useThreadComposerAttachmentRuntime
};
//# sourceMappingURL=AttachmentContext.js.map