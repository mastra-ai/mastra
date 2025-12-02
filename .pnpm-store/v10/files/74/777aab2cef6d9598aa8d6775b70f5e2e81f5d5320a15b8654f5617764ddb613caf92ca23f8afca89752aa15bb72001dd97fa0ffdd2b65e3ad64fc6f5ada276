"use client";

import { ComponentType, type FC, memo, useMemo } from "react";
import { useMessage, useMessageRuntime } from "../../context";
import { useMessageAttachment } from "../../context/react/AttachmentContext";
import { AttachmentRuntimeProvider } from "../../context/providers/AttachmentRuntimeProvider";
import { CompleteAttachment } from "../../types";

export namespace MessagePrimitiveAttachments {
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
  components: MessagePrimitiveAttachments.Props["components"],
  attachment: CompleteAttachment,
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
  components: MessagePrimitiveAttachments.Props["components"];
}> = ({ components }) => {
  const Component = useMessageAttachment((a) => getComponent(components, a));

  if (!Component) return null;
  return <Component />;
};

export namespace MessagePrimitiveAttachmentByIndex {
  export type Props = {
    index: number;
    components?: MessagePrimitiveAttachments.Props["components"];
  };
}

/**
 * Renders a single attachment at the specified index within the current message.
 *
 * This component provides direct access to render a specific attachment
 * from the message's attachment list using the provided component configuration.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.AttachmentByIndex
 *   index={0}
 *   components={{
 *     Image: MyImageAttachment,
 *     Document: MyDocumentAttachment
 *   }}
 * />
 * ```
 */
export const MessagePrimitiveAttachmentByIndex: FC<MessagePrimitiveAttachmentByIndex.Props> =
  memo(
    ({ index, components }) => {
      const messageRuntime = useMessageRuntime();
      const runtime = useMemo(
        () => messageRuntime.getAttachmentByIndex(index),
        [messageRuntime, index],
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

MessagePrimitiveAttachmentByIndex.displayName =
  "MessagePrimitive.AttachmentByIndex";

export const MessagePrimitiveAttachments: FC<
  MessagePrimitiveAttachments.Props
> = ({ components }) => {
  const attachmentsCount = useMessage((message) => {
    if (message.role !== "user") return 0;
    return message.attachments.length;
  });

  const attachmentElements = useMemo(() => {
    return Array.from({ length: attachmentsCount }, (_, index) => (
      <MessagePrimitiveAttachmentByIndex
        key={index}
        index={index}
        components={components}
      />
    ));
  }, [attachmentsCount, components]);

  return attachmentElements;
};

MessagePrimitiveAttachments.displayName = "MessagePrimitive.Attachments";
