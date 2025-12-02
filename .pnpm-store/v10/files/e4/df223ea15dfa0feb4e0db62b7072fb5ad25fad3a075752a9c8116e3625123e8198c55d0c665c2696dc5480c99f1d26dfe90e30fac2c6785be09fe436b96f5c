"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";

type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;

export namespace AttachmentPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  /**
   * Props for the AttachmentPrimitive.Root component.
   * Accepts all standard div element props.
   */
  export type Props = PrimitiveDivProps;
}

/**
 * The root container component for an attachment.
 *
 * This component provides the foundational wrapper for attachment-related components
 * and content. It serves as the context provider for attachment state and actions.
 *
 * @example
 * ```tsx
 * <AttachmentPrimitive.Root>
 *   <AttachmentPrimitive.Name />
 *   <AttachmentPrimitive.Remove />
 * </AttachmentPrimitive.Root>
 * ```
 */
export const AttachmentPrimitiveRoot = forwardRef<
  AttachmentPrimitiveRoot.Element,
  AttachmentPrimitiveRoot.Props
>((props, ref) => {
  return <Primitive.div {...props} ref={ref} />;
});

AttachmentPrimitiveRoot.displayName = "AttachmentPrimitive.Root";
