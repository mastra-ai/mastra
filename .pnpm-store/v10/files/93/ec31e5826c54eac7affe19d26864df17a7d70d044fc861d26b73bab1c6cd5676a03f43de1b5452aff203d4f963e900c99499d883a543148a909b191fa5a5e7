import { Primitive } from "@radix-ui/react-primitive";
import { type ComponentRef, ComponentPropsWithoutRef } from "react";
export declare namespace ThreadPrimitiveViewport {
    type Element = ComponentRef<typeof Primitive.div>;
    type Props = ComponentPropsWithoutRef<typeof Primitive.div> & {
        /**
         * Whether to automatically scroll to the bottom when new messages are added.
         * When enabled, the viewport will automatically scroll to show the latest content.
         * @default true
         */
        autoScroll?: boolean | undefined;
    };
}
/**
 * A scrollable viewport container for thread messages.
 *
 * This component provides a scrollable area for displaying thread messages with
 * automatic scrolling capabilities. It manages the viewport state and provides
 * context for child components to access viewport-related functionality.
 *
 * @example
 * ```tsx
 * <ThreadPrimitive.Viewport autoScroll={true}>
 *   <ThreadPrimitive.Messages components={{ Message: MyMessage }} />
 * </ThreadPrimitive.Viewport>
 * ```
 */
export declare const ThreadPrimitiveViewport: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLDivElement> & import("react").HTMLAttributes<HTMLDivElement> & {
    asChild?: boolean;
}, "ref"> & {
    /**
     * Whether to automatically scroll to the bottom when new messages are added.
     * When enabled, the viewport will automatically scroll to show the latest content.
     * @default true
     */
    autoScroll?: boolean | undefined;
} & import("react").RefAttributes<HTMLDivElement>>;
//# sourceMappingURL=ThreadViewport.d.ts.map