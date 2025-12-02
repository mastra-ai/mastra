import { type ComponentType, type FC, PropsWithChildren } from "react";
import type { Unstable_AudioMessagePartComponent, EmptyMessagePartComponent, TextMessagePartComponent, ImageMessagePartComponent, SourceMessagePartComponent, ToolCallMessagePartComponent, ToolCallMessagePartProps, FileMessagePartComponent, ReasoningMessagePartComponent } from "../../types/MessagePartComponentTypes";
type MessagePartGroup = {
    groupKey: string | undefined;
    indices: number[];
};
export type GroupingFunction = (parts: readonly any[]) => MessagePartGroup[];
export declare namespace MessagePrimitiveUnstable_PartsGrouped {
    type Props = {
        /**
         * Function that takes an array of message parts and returns an array of groups.
         * Each group contains a key (for identification) and an array of indices.
         *
         * @example
         * ```tsx
         * // Group by parent ID (default behavior)
         * groupingFunction={(parts) => {
         *   const groups = new Map<string, number[]>();
         *   parts.forEach((part, i) => {
         *     const key = part.parentId ?? `__ungrouped_${i}`;
         *     const indices = groups.get(key) ?? [];
         *     indices.push(i);
         *     groups.set(key, indices);
         *   });
         *   return Array.from(groups.entries()).map(([key, indices]) => ({
         *     key: key.startsWith("__ungrouped_") ? undefined : key,
         *     indices
         *   }));
         * }}
         * ```
         *
         * @example
         * ```tsx
         * // Group by tool name
         * import { groupMessagePartsByToolName } from "@assistant-ui/react";
         *
         * <MessagePrimitive.Unstable_PartsGrouped
         *   groupingFunction={groupMessagePartsByToolName}
         *   components={{
         *     Group: ({ key, indices, children }) => {
         *       if (!key) return <>{children}</>;
         *       return (
         *         <div className="tool-group">
         *           <h4>Tool: {key}</h4>
         *           {children}
         *         </div>
         *       );
         *     }
         *   }}
         * />
         * ```
         */
        groupingFunction: GroupingFunction;
        /**
         * Component configuration for rendering different types of message content.
         *
         * You can provide custom components for each content type (text, image, file, etc.)
         * and configure tool rendering behavior. If not provided, default components will be used.
         */
        components: {
            /** Component for rendering empty messages */
            Empty?: EmptyMessagePartComponent | undefined;
            /** Component for rendering text content */
            Text?: TextMessagePartComponent | undefined;
            /** Component for rendering reasoning content (typically hidden) */
            Reasoning?: ReasoningMessagePartComponent | undefined;
            /** Component for rendering source content */
            Source?: SourceMessagePartComponent | undefined;
            /** Component for rendering image content */
            Image?: ImageMessagePartComponent | undefined;
            /** Component for rendering file content */
            File?: FileMessagePartComponent | undefined;
            /** Component for rendering audio content (experimental) */
            Unstable_Audio?: Unstable_AudioMessagePartComponent | undefined;
            /** Configuration for tool call rendering */
            tools?: {
                /** Map of tool names to their specific components */
                by_name?: Record<string, ToolCallMessagePartComponent | undefined> | undefined;
                /** Fallback component for unregistered tools */
                Fallback?: ComponentType<ToolCallMessagePartProps> | undefined;
            } | {
                /** Override component that handles all tool calls */
                Override: ComponentType<ToolCallMessagePartProps>;
            } | undefined;
            /**
             * Component for rendering grouped message parts.
             *
             * When provided, this component will automatically wrap message parts that share
             * the same group key as determined by the groupingFunction.
             *
             * The component receives:
             * - `groupKey`: The group key (or undefined for ungrouped parts)
             * - `indices`: Array of indices for the parts in this group
             * - `children`: The rendered message part components
             *
             * @example
             * ```tsx
             * // Collapsible group
             * Group: ({ groupKey, indices, children }) => {
             *   if (!groupKey) return <>{children}</>;
             *   return (
             *     <details className="message-group">
             *       <summary>
             *         Group {groupKey} ({indices.length} parts)
             *       </summary>
             *       <div className="group-content">
             *         {children}
             *       </div>
             *     </details>
             *   );
             * }
             * ```
             *
             * @param groupKey - The group key (undefined for ungrouped parts)
             * @param indices - Array of indices for the parts in this group
             * @param children - Rendered message part components to display within the group
             */
            Group?: ComponentType<PropsWithChildren<{
                groupKey: string | undefined;
                indices: number[];
            }>>;
        } | undefined;
    };
}
/**
 * Renders the parts of a message grouped by a custom grouping function.
 *
 * This component allows you to group message parts based on any criteria you define.
 * The grouping function receives all message parts and returns an array of groups,
 * where each group has a key and an array of part indices.
 *
 * @example
 * ```tsx
 * // Group by parent ID (default behavior)
 * <MessagePrimitive.Unstable_PartsGrouped
 *   components={{
 *     Text: ({ text }) => <p className="message-text">{text}</p>,
 *     Image: ({ image }) => <img src={image} alt="Message image" />,
 *     Group: ({ groupKey, indices, children }) => {
 *       if (!groupKey) return <>{children}</>;
 *       return (
 *         <div className="parent-group border rounded p-4">
 *           <h4>Parent ID: {groupKey}</h4>
 *           {children}
 *         </div>
 *       );
 *     }
 *   }}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // Group by tool name
 * import { groupMessagePartsByToolName } from "@assistant-ui/react";
 *
 * <MessagePrimitive.Unstable_PartsGrouped
 *   groupingFunction={groupMessagePartsByToolName}
 *   components={{
 *     Group: ({ groupKey, indices, children }) => {
 *       if (!groupKey) return <>{children}</>;
 *       return (
 *         <div className="tool-group">
 *           <h4>Tool: {groupKey}</h4>
 *           {children}
 *         </div>
 *       );
 *     }
 *   }}
 * />
 * ```
 */
export declare const MessagePrimitiveUnstable_PartsGrouped: FC<MessagePrimitiveUnstable_PartsGrouped.Props>;
/**
 * Renders the parts of a message grouped by their parent ID.
 * This is a convenience wrapper around Unstable_PartsGrouped with parent ID grouping.
 *
 * @deprecated Use MessagePrimitive.Unstable_PartsGrouped instead for more flexibility
 */
export declare const MessagePrimitiveUnstable_PartsGroupedByParentId: FC<Omit<MessagePrimitiveUnstable_PartsGrouped.Props, "groupingFunction">>;
export {};
//# sourceMappingURL=MessagePartsGrouped.d.ts.map