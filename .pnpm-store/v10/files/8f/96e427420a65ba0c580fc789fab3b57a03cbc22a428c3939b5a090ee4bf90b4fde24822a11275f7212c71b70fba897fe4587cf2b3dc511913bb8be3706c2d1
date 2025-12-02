"use client";

import { Primitive } from "@radix-ui/react-primitive";
import {
  type ComponentRef,
  forwardRef,
  ComponentPropsWithoutRef,
  ElementType,
} from "react";
import { useMessagePartText } from "./useMessagePartText";
import { useSmooth } from "../../utils/smooth/useSmooth";

export namespace MessagePartPrimitiveText {
  export type Element = ComponentRef<typeof Primitive.span>;
  export type Props = Omit<
    ComponentPropsWithoutRef<typeof Primitive.span>,
    "children" | "asChild"
  > & {
    /**
     * Whether to enable smooth text streaming animation.
     * When enabled, text appears with a typing effect as it streams in.
     * @default true
     */
    smooth?: boolean;
    /**
     * The HTML element or React component to render as.
     * @default "span"
     */
    component?: ElementType;
  };
}

/**
 * Renders the text content of a message part with optional smooth streaming.
 *
 * This component displays text content from the current message part context,
 * with support for smooth streaming animation that shows text appearing
 * character by character as it's generated.
 *
 * @example
 * ```tsx
 * <MessagePartPrimitive.Text
 *   smooth={true}
 *   component="p"
 *   className="message-text"
 * />
 * ```
 */
export const MessagePartPrimitiveText = forwardRef<
  MessagePartPrimitiveText.Element,
  MessagePartPrimitiveText.Props
>(({ smooth = true, component: Component = "span", ...rest }, forwardedRef) => {
  const { text, status } = useSmooth(useMessagePartText(), smooth);

  return (
    <Component data-status={status.type} {...rest} ref={forwardedRef}>
      {text}
    </Component>
  );
});

MessagePartPrimitiveText.displayName = "MessagePartPrimitive.Text";
