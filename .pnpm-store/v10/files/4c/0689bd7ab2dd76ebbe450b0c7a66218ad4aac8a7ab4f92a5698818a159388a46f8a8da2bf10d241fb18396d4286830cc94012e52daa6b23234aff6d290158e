import { ActionButtonElement, ActionButtonProps } from "../../utils/createActionButton";
/**
 * Hook that provides reload functionality for action bar buttons.
 *
 * This hook returns a callback function that reloads/regenerates the current assistant message,
 * or null if reloading is not available (e.g., thread is running, disabled, or message is not from assistant).
 *
 * @returns A reload callback function, or null if reloading is disabled
 *
 * @example
 * ```tsx
 * function CustomReloadButton() {
 *   const reload = useActionBarReload();
 *
 *   return (
 *     <button onClick={reload} disabled={!reload}>
 *       {reload ? "Reload Message" : "Cannot Reload"}
 *     </button>
 *   );
 * }
 * ```
 */
declare const useActionBarReload: () => (() => void) | null;
export declare namespace ActionBarPrimitiveReload {
    type Element = ActionButtonElement;
    /**
     * Props for the ActionBarPrimitive.Reload component.
     * Inherits all button element props and action button functionality.
     */
    type Props = ActionButtonProps<typeof useActionBarReload>;
}
/**
 * A button component that reloads/regenerates the current assistant message.
 *
 * This component automatically handles reloading the current assistant message
 * and is disabled when reloading is not available (e.g., thread is running,
 * disabled, or message is not from assistant).
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Reload>
 *   Reload Message
 * </ActionBarPrimitive.Reload>
 * ```
 */
export declare const ActionBarPrimitiveReload: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
}, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=ActionBarReload.d.ts.map