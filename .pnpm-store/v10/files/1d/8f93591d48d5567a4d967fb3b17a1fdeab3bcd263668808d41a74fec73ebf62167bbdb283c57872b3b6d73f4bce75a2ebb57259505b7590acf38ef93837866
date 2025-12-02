"use client";

import { ComponentType, type FC, memo, useMemo } from "react";
import { Attachment } from "../../types";
import { useComposer, useComposerRuntime } from "../../context";
import { useThreadComposerAttachment } from "../../context/react/AttachmentContext";
import { AttachmentRuntimeProvider } from "../../context/providers/AttachmentRuntimeProvider";

export namespace ComposerPrimitiveAttachments {
  export type Props = {
    components:
      | {
          Image?: ComponentType | undefined;
          Document?: ComponentType | undefined;
          File?: ComponentType | undefined;
          Attachment?: ComponentType | undefined;
        }
      | undefined;
  };
}

const getComponent = (
  components: ComposerPrimitiveAttachments.Props["components"],
  attachment: Attachment,
) => {
  const type = attachment.type;
  switch (type) {
    case "image":
      return components?.Image ?? components?.Attachment;
    case "document":
      return components?.Document ?? components?.Attachment;
    case "file":
      return components?.File ?? components?.Attachment;
    default:
      const _exhaustiveCheck: never = type;
      throw new Error(`Unknown attachment type: ${_exhaustiveCheck}`);
  }
};

const AttachmentComponent: FC<{
  components: ComposerPrimitiveAttachments.Props["components"];
}> = ({ components }) => {
  const Component = useThreadComposerAttachment((a) =>
    getComponent(components, a),
  );

  if (!Component) return null;
  return <Component />;
};

export namespace ComposerPrimitiveAttachmentByIndex {
  export type Props = {
    index: number;
    components?: ComposerPrimitiveAttachments.Props["components"];
  };
}

/**
 * Renders a single attachment at the specified index within the composer.
 *
 * This component provides direct access to render a specific attachment
 * from the composer's attachment list using the provided component configuration.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.AttachmentByIndex
 *   index={0}
 *   components={{
 *     Image: MyImageAttachment,
 *     Document: MyDocumentAttachment
 *   }}
 * />
 * ```
 */
export const ComposerPrimitiveAttachmentByIndex: FC<ComposerPrimitiveAttachmentByIndex.Props> =
  memo(
    ({ index, components }) => {
      const composerRuntime = useComposerRuntime();
      const runtime = useMemo(
        () => composerRuntime.getAttachmentByIndex(index),
        [composerRuntime, index],
      );

      return (
        <AttachmentRuntimeProvider runtime={runtime}>
          <AttachmentComponent components={components} />
        </AttachmentRuntimeProvider>
      );
    },
    (prev, next) =>
      prev.index === next.index &&
      prev.components?.Image === next.components?.Image &&
      prev.components?.Document === next.components?.Document &&
      prev.components?.File === next.components?.File &&
      prev.components?.Attachment === next.components?.Attachment,
  );

ComposerPrimitiveAttachmentByIndex.displayName =
  "ComposerPrimitive.AttachmentByIndex";

export const ComposerPrimitiveAttachments: FC<
  ComposerPrimitiveAttachments.Props
> = ({ components }) => {
  const attachmentsCount = useComposer((s) => s.attachments.length);

  const attachmentElements = useMemo(() => {
    return Array.from({ length: attachmentsCount }, (_, index) => (
      <ComposerPrimitiveAttachmentByIndex
        key={index}
        index={index}
        components={components}
      />
    ));
  }, [attachmentsCount, components]);

  return attachmentElements;
};

ComposerPrimitiveAttachments.displayName = "ComposerPrimitive.Attachments";
