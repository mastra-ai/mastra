import { ActionButtonElement, ActionButtonProps } from "../../utils/createActionButton";
/**
 * Hook that provides edit functionality for action bar buttons.
 *
 * This hook returns a callback function that starts editing the current message,
 * or null if editing is not available (e.g., already in editing mode).
 *
 * @returns An edit callback function, or null if editing is disabled
 *
 * @example
 * ```tsx
 * function CustomEditButton() {
 *   const edit = useActionBarEdit();
 *
 *   return (
 *     <button onClick={edit} disabled={!edit}>
 *       {edit ? "Edit Message" : "Cannot Edit"}
 *     </button>
 *   );
 * }
 * ```
 */
declare const useActionBarEdit: () => (() => void) | null;
export declare namespace ActionBarPrimitiveEdit {
    type Element = ActionButtonElement;
    /**
     * Props for the ActionBarPrimitive.Edit component.
     * Inherits all button element props and action button functionality.
     */
    type Props = ActionButtonProps<typeof useActionBarEdit>;
}
/**
 * A button component that starts editing the current message.
 *
 * This component automatically handles starting the edit mode for the current message
 * and is disabled when editing is not available (e.g., already in editing mode).
 *
 * @example
 * ```tsx
 * <ActionBarPrimitive.Edit>
 *   Edit Message
 * </ActionBarPrimitive.Edit>
 * ```
 */
export declare const ActionBarPrimitiveEdit: import("react").ForwardRefExoticComponent<Omit<import("react").ClassAttributes<HTMLButtonElement> & import("react").ButtonHTMLAttributes<HTMLButtonElement> & {
    asChild?: boolean;
}, "ref"> & import("react").RefAttributes<HTMLButtonElement>>;
export {};
//# sourceMappingURL=ActionBarEdit.d.ts.map