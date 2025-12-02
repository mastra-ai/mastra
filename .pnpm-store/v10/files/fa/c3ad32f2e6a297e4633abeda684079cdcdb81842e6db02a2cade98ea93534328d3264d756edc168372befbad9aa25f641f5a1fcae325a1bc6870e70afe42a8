"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, forwardRef, ComponentPropsWithoutRef } from "react";
import { useMessagePartImage } from "./useMessagePartImage";

export namespace MessagePartPrimitiveImage {
  export type Element = ComponentRef<typeof Primitive.img>;
  /**
   * Props for the MessagePartPrimitive.Image component.
   * Accepts all standard img element props.
   */
  export type Props = ComponentPropsWithoutRef<typeof Primitive.img>;
}

/**
 * Renders an image from the current message part context.
 *
 * This component displays image content from the current message part,
 * automatically setting the src attribute from the message part's image data.
 *
 * @example
 * ```tsx
 * <MessagePartPrimitive.Image
 *   alt="Generated image"
 *   className="message-image"
 *   style={{ maxWidth: '100%' }}
 * />
 * ```
 */
export const MessagePartPrimitiveImage = forwardRef<
  MessagePartPrimitiveImage.Element,
  MessagePartPrimitiveImage.Props
>((props, forwardedRef) => {
  const { image } = useMessagePartImage();
  return <Primitive.img src={image} {...props} ref={forwardedRef} />;
});

MessagePartPrimitiveImage.displayName = "MessagePartPrimitive.Image";
