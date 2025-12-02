"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, forwardRef, ComponentPropsWithoutRef } from "react";

export namespace ThreadPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  /**
   * Props for the ThreadPrimitive.Root component.
   * Accepts all standard div element props.
   */
  export type Props = ComponentPropsWithoutRef<typeof Primitive.div>;
}

/**
 * The root container component for a thread.
 *
 * This component serves as the foundational wrapper for all thread-related components.
 * It provides the basic structure and context needed for thread functionality.
 *
 * @example
 * ```tsx
 * <ThreadPrimitive.Root>
 *   <ThreadPrimitive.Viewport>
 *     <ThreadPrimitive.Messages components={{ Message: MyMessage }} />
 *   </ThreadPrimitive.Viewport>
 * </ThreadPrimitive.Root>
 * ```
 */
export const ThreadPrimitiveRoot = forwardRef<
  ThreadPrimitiveRoot.Element,
  ThreadPrimitiveRoot.Props
>((props, ref) => {
  return <Primitive.div {...props} ref={ref} />;
});

ThreadPrimitiveRoot.displayName = "ThreadPrimitive.Root";
