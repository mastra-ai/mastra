"use client";

import { ComponentPropsWithoutRef, ComponentRef, forwardRef } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ScopedProps, usePopoverScope } from "./scope";
import { composeEventHandlers } from "@radix-ui/primitive";

export namespace AssistantModalPrimitiveContent {
  export type Element = ComponentRef<typeof PopoverPrimitive.Content>;
  export type Props = ComponentPropsWithoutRef<
    typeof PopoverPrimitive.Content
  > & {
    portalProps?:
      | ComponentPropsWithoutRef<typeof PopoverPrimitive.Portal>
      | undefined;
    dissmissOnInteractOutside?: boolean | undefined;
  };
}

export const AssistantModalPrimitiveContent = forwardRef<
  AssistantModalPrimitiveContent.Element,
  AssistantModalPrimitiveContent.Props
>(
  (
    {
      __scopeAssistantModal,
      side,
      align,
      onInteractOutside,
      dissmissOnInteractOutside = false,
      portalProps,
      ...props
    }: ScopedProps<AssistantModalPrimitiveContent.Props>,
    forwardedRef,
  ) => {
    const scope = usePopoverScope(__scopeAssistantModal);

    return (
      <PopoverPrimitive.Portal {...scope} {...portalProps}>
        <PopoverPrimitive.Content
          {...scope}
          {...props}
          ref={forwardedRef}
          side={side ?? "top"}
          align={align ?? "end"}
          onInteractOutside={composeEventHandlers(
            onInteractOutside,
            dissmissOnInteractOutside ? undefined : (e) => e.preventDefault(),
          )}
        />
      </PopoverPrimitive.Portal>
    );
  },
);

AssistantModalPrimitiveContent.displayName = "AssistantModalPrimitive.Content";
