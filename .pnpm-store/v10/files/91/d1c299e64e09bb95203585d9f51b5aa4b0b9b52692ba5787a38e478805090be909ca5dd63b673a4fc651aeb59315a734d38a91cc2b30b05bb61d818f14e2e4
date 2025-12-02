"use client";

import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, forwardRef, ComponentPropsWithoutRef } from "react";
import {
  useActionBarFloatStatus,
  HideAndFloatStatus,
} from "./useActionBarFloatStatus";

type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;

export namespace ActionBarPrimitiveRoot {
  export type Element = ComponentRef<typeof Primitive.div>;
  export type Props = PrimitiveDivProps & {
    /**
     * Whether to hide the action bar when the thread is running.
     * @default false
     */
    hideWhenRunning?: boolean | undefined;
    /**
     * Controls when the action bar should automatically hide.
     * - "always": Always hide unless hovered
     * - "not-last": Hide unless this is the last message
     * - "never": Never auto-hide
     * @default "never"
     */
    autohide?: "always" | "not-last" | "never" | undefined;
    /**
     * Controls floating behavior when auto-hidden.
     * - "always": Always float when hidden
     * - "single-branch": Float only for single-branch messages
     * - "never": Never float
     * @default "never"
     */
    autohideFloat?: "always" | "single-branch" | "never" | undefined;
  };
}

/**
 * The root container for action bar components.
 *
 * This component provides intelligent visibility and floating behavior for action bars,
 * automatically hiding and showing based on message state, hover status, and configuration.
 * It supports floating mode for better UX when space is limited.
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Root
 *   hideWhenRunning={true}
 *   autohide="not-last"
 *   autohideFloat="single-branch"
 * >
 *   <ActionBarPrimitive.Copy />
 *   <ActionBarPrimitive.Edit />
 *   <ActionBarPrimitive.Reload />
 * </ActionBarPrimitive.Root>
 * ```
 */
export const ActionBarPrimitiveRoot = forwardRef<
  ActionBarPrimitiveRoot.Element,
  ActionBarPrimitiveRoot.Props
>(({ hideWhenRunning, autohide, autohideFloat, ...rest }, ref) => {
  const hideAndfloatStatus = useActionBarFloatStatus({
    hideWhenRunning,
    autohide,
    autohideFloat,
  });

  if (hideAndfloatStatus === HideAndFloatStatus.Hidden) return null;

  return (
    <Primitive.div
      {...(hideAndfloatStatus === HideAndFloatStatus.Floating
        ? { "data-floating": "true" }
        : null)}
      {...rest}
      ref={ref}
    />
  );
});

ActionBarPrimitiveRoot.displayName = "ActionBarPrimitive.Root";
