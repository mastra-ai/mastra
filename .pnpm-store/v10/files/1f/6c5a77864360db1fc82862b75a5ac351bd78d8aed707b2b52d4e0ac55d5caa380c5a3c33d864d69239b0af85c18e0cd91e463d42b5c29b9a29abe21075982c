import { ComponentType, type FC } from "react";
export declare namespace MessagePrimitiveAttachments {
    type Props = {
        components: {
            Image?: ComponentType | undefined;
            Document?: ComponentType | undefined;
            File?: ComponentType | undefined;
            Attachment?: ComponentType | undefined;
        } | undefined;
    };
}
export declare namespace MessagePrimitiveAttachmentByIndex {
    type Props = {
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
export declare const MessagePrimitiveAttachmentByIndex: FC<MessagePrimitiveAttachmentByIndex.Props>;
export declare const MessagePrimitiveAttachments: FC<MessagePrimitiveAttachments.Props>;
//# sourceMappingURL=MessageAttachments.d.ts.map