"use client";

// src/primitives/composer/ComposerAttachments.tsx
import { memo, useMemo } from "react";
import { useComposer, useComposerRuntime } from "../../context/index.js";
import { useThreadComposerAttachment } from "../../context/react/AttachmentContext.js";
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
  const Component = useThreadComposerAttachment(
    (a) => getComponent(components, a)
  );
  if (!Component) return null;
  return /* @__PURE__ */ jsx(Component, {});
};
var ComposerPrimitiveAttachmentByIndex = memo(
  ({ index, components }) => {
    const composerRuntime = useComposerRuntime();
    const runtime = useMemo(
      () => composerRuntime.getAttachmentByIndex(index),
      [composerRuntime, index]
    );
    return /* @__PURE__ */ jsx(AttachmentRuntimeProvider, { runtime, children: /* @__PURE__ */ jsx(AttachmentComponent, { components }) });
  },
  (prev, next) => prev.index === next.index && prev.components?.Image === next.components?.Image && prev.components?.Document === next.components?.Document && prev.components?.File === next.components?.File && prev.components?.Attachment === next.components?.Attachment
);
ComposerPrimitiveAttachmentByIndex.displayName = "ComposerPrimitive.AttachmentByIndex";
var ComposerPrimitiveAttachments = ({ components }) => {
  const attachmentsCount = useComposer((s) => s.attachments.length);
  const attachmentElements = useMemo(() => {
    return Array.from({ length: attachmentsCount }, (_, index) => /* @__PURE__ */ jsx(
      ComposerPrimitiveAttachmentByIndex,
      {
        index,
        components
      },
      index
    ));
  }, [attachmentsCount, components]);
  return attachmentElements;
};
ComposerPrimitiveAttachments.displayName = "ComposerPrimitive.Attachments";
export {
  ComposerPrimitiveAttachmentByIndex,
  ComposerPrimitiveAttachments
};
//# sourceMappingURL=ComposerAttachments.js.map