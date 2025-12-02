import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, ComponentPropsWithoutRef } from "react";
type PrimitiveDivProps = ComponentPropsWithoutRef<typeof Primitive.div>;
export declare namespace ActionBarPrimitiveRoot {
    type Element = ComponentRef<typeof Primitive.div>;
    type Props = PrimitiveDivProps & {
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
export declare const ActionBarPrimitiveRoot: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLDivElement> & import("react").HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean;
}, "ref"> & {
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
} & import("react").RefAttributes<HTMLDivElement>>;
export {};
//# sourceMappingURL=ActionBarRoot.d.ts.map