import { ActionButtonProps } from "../../utils/createActionButton";
/**
 * Hook that provides copy functionality for action bar buttons.
 *
 * This hook returns a callback function that copies message content to the clipboard,
 * or null if copying is not available. It handles both regular message content and
 * composer text when in editing mode.
 *
 * @param options Configuration options
 * @param options.copiedDuration Duration in milliseconds to show the copied state
 * @returns A copy callback function, or null if copying is disabled
 *
 * @example
 * ```tsx
 * function CustomCopyButton() {
 *   const copy = useActionBarPrimitiveCopy({ copiedDuration: 2000 });
 *
 *   return (
 *     <button onClick={copy} disabled={!copy}>
 *       {copy ? "Copy" : "Cannot Copy"}
 *     </button>
 *   );
 * }
 * ```
 */
declare const useActionBarPrimitiveCopy: ({ copiedDuration, }?: {
    copiedDuration?: number | undefined;
}) => (() => void) | null;
export declare namespace ActionBarPrimitiveCopy {
    type Element = HTMLButtonElement;
    /**
     * Props for the ActionBarPrimitive.Copy component.
     * Inherits all button element props and action button functionality.
     */
    type Props = ActionButtonProps<typeof useActionBarPrimitiveCopy>;
}
/**
 * A button component that copies message content to the clipboard.
 *
 * This component automatically handles copying message text to the clipboard
 * and provides visual feedback through the data-copied attribute. It's disabled
 * when there's no copyable content available.
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Copy copiedDuration={2000}>
 *   Copy Message
 * </ActionBarPrimitive.Copy>
 * ```
 */
export declare const ActionBarPrimitiveCopy: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
}, "ref"> & {
    copiedDuration?: number | undefined;
} & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=ActionBarCopy.d.ts.map