import { ActionButtonElement, ActionButtonProps } from "../../utils/createActionButton";
/**
 * Hook that provides navigation to the previous branch functionality.
 *
 * This hook returns a callback function that switches to the previous branch
 * in the message branch tree, or null if there is no previous branch available.
 *
 * @returns A previous branch callback function, or null if navigation is disabled
 *
 * @example
 * ```tsx
 * function CustomPreviousButton() {
 *   const previous = useBranchPickerPrevious();
 *
 *   return (
 *     <button onClick={previous} disabled={!previous}>
 *       {previous ? "Previous Branch" : "No Previous Branch"}
 *     </button>
 *   );
 * }
 * ```
 */
declare const useBranchPickerPrevious: () => (() => void) | null;
export declare namespace BranchPickerPrimitivePrevious {
    type Element = ActionButtonElement;
    /**
     * Props for the BranchPickerPrimitive.Previous component.
     * Inherits all button element props and action button functionality.
     */
    type Props = ActionButtonProps<typeof useBranchPickerPrevious>;
}
/**
 * A button component that navigates to the previous branch in the message tree.
 *
 * This component automatically handles switching to the previous available branch
 * and is disabled when there are no previous branches to navigate to.
 *
 * @example
 * ```tsx
 * <BranchPickerPrimitive.Previous>
 *   ← Previous
 * </BranchPickerPrimitive.Previous>
 * ```
 */
export declare const BranchPickerPrimitivePrevious: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
}, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=BranchPickerPrevious.d.ts.map