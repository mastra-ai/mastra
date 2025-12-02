"use client";

import { composeEventHandlers } from "@radix-ui/primitive";
import { Primitive } from "@radix-ui/react-primitive";
import {
  type ComponentRef,
  type FormEvent,
  forwardRef,
  ComponentPropsWithoutRef,
} from "react";
import { useComposerSend } from "./ComposerSend";

export namespace ComposerPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.form>;
  /**
   * Props for the ComposerPrimitive.Root component.
   * Accepts all standard form element props.
   */
  export type Props = ComponentPropsWithoutRef<typeof Primitive.form>;
}

/**
 * The root form container for message composition.
 *
 * This component provides a form wrapper that handles message submission when the form
 * is submitted (e.g., via Enter key or submit button). It automatically prevents the
 * default form submission and triggers the composer's send functionality.
 *
 * @example
 * ```tsx
 * <ComposerPrimitive.Root>
 *   <ComposerPrimitive.Input placeholder="Type your message..." />
 *   <ComposerPrimitive.Send>Send</ComposerPrimitive.Send>
 * </ComposerPrimitive.Root>
 * ```
 */
export const ComposerPrimitiveRoot = forwardRef<
  ComposerPrimitiveRoot.Element,
  ComposerPrimitiveRoot.Props
>(({ onSubmit, ...rest }, forwardedRef) => {
  const send = useComposerSend();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    if (!send) return;
    send();
  };

  return (
    <Primitive.form
      {...rest}
      ref={forwardedRef}
      onSubmit={composeEventHandlers(onSubmit, handleSubmit)}
    />
  );
});

ComposerPrimitiveRoot.displayName = "ComposerPrimitive.Root";
