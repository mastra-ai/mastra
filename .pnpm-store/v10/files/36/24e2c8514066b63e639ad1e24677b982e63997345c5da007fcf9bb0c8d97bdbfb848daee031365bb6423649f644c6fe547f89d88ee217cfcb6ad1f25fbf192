"use client";

import { Primitive } from "@radix-ui/react-primitive";
import {
  type ComponentRef,
  forwardRef,
  ComponentPropsWithoutRef,
  useCallback,
} from "react";
import { useMessageUtilsStore } from "../../context/react/MessageContext";
import { useManagedRef } from "../../utils/hooks/useManagedRef";
import { useComposedRefs } from "@radix-ui/react-compose-refs";

const useIsHoveringRef = () => {
  const messageUtilsStore = useMessageUtilsStore();
  const callbackRef = useCallback(
    (el: HTMLElement) => {
      const setIsHovering = messageUtilsStore.getState().setIsHovering;

      const handleMouseEnter = () => {
        setIsHovering(true);
      };
      const handleMouseLeave = () => {
        setIsHovering(false);
      };

      el.addEventListener("mouseenter", handleMouseEnter);
      el.addEventListener("mouseleave", handleMouseLeave);

      return () => {
        el.removeEventListener("mouseenter", handleMouseEnter);
        el.removeEventListener("mouseleave", handleMouseLeave);
        setIsHovering(false);
      };
    },
    [messageUtilsStore],
  );

  return useManagedRef(callbackRef);
};

export namespace MessagePrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  /**
   * Props for the MessagePrimitive.Root component.
   * Accepts all standard div element props.
   */
  export type Props = ComponentPropsWithoutRef<typeof Primitive.div>;
}

/**
 * The root container component for a message.
 *
 * This component provides the foundational wrapper for message content and handles
 * hover state management for the message. It automatically tracks when the user
 * is hovering over the message, which can be used by child components like action bars.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.Root>
 *   <MessagePrimitive.Content />
 *   <ActionBarPrimitive.Root>
 *     <ActionBarPrimitive.Copy />
 *     <ActionBarPrimitive.Edit />
 *   </ActionBarPrimitive.Root>
 * </MessagePrimitive.Root>
 * ```
 */
export const MessagePrimitiveRoot = forwardRef<
  MessagePrimitiveRoot.Element,
  MessagePrimitiveRoot.Props
>((props, forwardRef) => {
  const isHoveringRef = useIsHoveringRef();
  const ref = useComposedRefs<HTMLDivElement>(forwardRef, isHoveringRef);

  return <Primitive.div {...props} ref={ref} />;
});

MessagePrimitiveRoot.displayName = "MessagePrimitive.Root";
