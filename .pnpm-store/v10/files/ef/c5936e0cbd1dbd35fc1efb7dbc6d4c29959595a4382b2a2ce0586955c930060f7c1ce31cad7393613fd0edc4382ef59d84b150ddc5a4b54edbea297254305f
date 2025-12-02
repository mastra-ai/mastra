"use client";

// src/primitives/message/MessageAttachments.tsx
import { memo, useMemo } from "react";
import { useMessage, useMessageRuntime } from "../../context/index.js";
import { useMessageAttachment } from "../../context/react/AttachmentContext.js";
import { AttachmentRuntimeProvider } from "../../context/providers/AttachmentRuntimeProvider.js";
import { jsx } from "react/jsx-runtime";
var getComponent = (components, attachment) => {
  const type = attachment.type;
  switch (type) {
    case "image":
      return components?.Image ?? components?.Attachment;
    case "document":
      return components?.Document ?? components?.Attachment;
    case "file":
      return components?.File ?? components?.Attachment;
    default:
      const _exhaustiveCheck = type;
      throw new Error(`Unknown attachment type: ${_exhaustiveCheck}`);
  }
};
var AttachmentComponent = ({ components }) => {
  const Component = useMessageAttachment((a) => getComponent(components, a));
  if (!Component) return null;
  return /* @__PURE__ */ jsx(Component, {});
};
var MessagePrimitiveAttachmentByIndex = memo(
  ({ index, components }) => {
    const messageRuntime = useMessageRuntime();
    const runtime = useMemo(
      () => messageRuntime.getAttachmentByIndex(index),
      [messageRuntime, index]
    );
    return /* @__PURE__ */ jsx(AttachmentRuntimeProvider, { runtime, children: /* @__PURE__ */ jsx(AttachmentComponent, { components }) });
  },
  (prev, next) => prev.index === next.index && prev.components?.Image === next.components?.Image && prev.components?.Document === next.components?.Document && prev.components?.File === next.components?.File && prev.components?.Attachment === next.components?.Attachment
);
MessagePrimitiveAttachmentByIndex.displayName = "MessagePrimitive.AttachmentByIndex";
var MessagePrimitiveAttachments = ({ components }) => {
  const attachmentsCount = useMessage((message) => {
    if (message.role !== "user") return 0;
    return message.attachments.length;
  });
  const attachmentElements = useMemo(() => {
    return Array.from({ length: attachmentsCount }, (_, index) => /* @__PURE__ */ jsx(
      MessagePrimitiveAttachmentByIndex,
      {
        index,
        components
      },
      index
    ));
  }, [attachmentsCount, components]);
  return attachmentElements;
};
MessagePrimitiveAttachments.displayName = "MessagePrimitive.Attachments";
export {
  MessagePrimitiveAttachmentByIndex,
  MessagePrimitiveAttachments
};
//# sourceMappingURL=MessageAttachments.js.map