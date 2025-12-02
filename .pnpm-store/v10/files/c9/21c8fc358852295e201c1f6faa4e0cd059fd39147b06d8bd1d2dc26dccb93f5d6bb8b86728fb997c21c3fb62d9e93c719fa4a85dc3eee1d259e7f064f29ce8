import { type ComponentType, type FC, PropsWithChildren } from "react";
import type { Unstable_AudioMessagePartComponent, EmptyMessagePartComponent, TextMessagePartComponent, ImageMessagePartComponent, SourceMessagePartComponent, ToolCallMessagePartComponent, ToolCallMessagePartProps, FileMessagePartComponent, ReasoningMessagePartComponent } from "../../types/MessagePartComponentTypes";
export declare namespace MessagePrimitiveParts {
    type Props = {
        /**
         * Component configuration for rendering different types of message content.
         *
         * You can provide custom components for each content type (text, image, file, etc.)
         * and configure tool rendering behavior. If not provided, default components will be used.
         */
        components?: {
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
             * Component for rendering grouped consecutive tool calls.
             *
             * When provided, this component will automatically wrap consecutive tool-call
             * message parts, allowing you to create collapsible sections, custom styling,
             * or other grouped presentations for multiple tool calls.
             *
             * The component receives:
             * - `startIndex`: The index of the first tool call in the group
             * - `endIndex`: The index of the last tool call in the group
             * - `children`: The rendered tool call components
             *
             * @example
             * ```tsx
             * // Collapsible tool group
             * ToolGroup: ({ startIndex, endIndex, children }) => (
             *   <details className="tool-group">
             *     <summary>
             *       {endIndex - startIndex + 1} tool calls
             *     </summary>
             *     <div className="tool-group-content">
             *       {children}
             *     </div>
             *   </details>
             * )
             * ```
             *
             * @example
             * ```tsx
             * // Custom styled tool group with header
             * ToolGroup: ({ startIndex, endIndex, children }) => (
             *   <div className="border rounded-lg p-4 my-2">
             *     <div className="text-sm text-gray-600 mb-2">
             *       Tool execution #{startIndex + 1}-{endIndex + 1}
             *     </div>
             *     <div className="space-y-2">
             *       {children}
             *     </div>
             *   </div>
             * )
             * ```
             *
             * @param startIndex - Index of the first tool call in the group
             * @param endIndex - Index of the last tool call in the group
             * @param children - Rendered tool call components to display within the group
             *
             * @deprecated This feature is still experimental and subject to change.
             */
            ToolGroup?: ComponentType<PropsWithChildren<{
                startIndex: number;
                endIndex: number;
            }>>;
        } | undefined;
    };
}
export declare namespace MessagePrimitivePartByIndex {
    type Props = {
        index: number;
        components: MessagePrimitiveParts.Props["components"];
    };
}
/**
 * Renders a single message part at the specified index.
 *
 * This component provides direct access to render a specific message part
 * within the current message context, using the provided component configuration.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.PartByIndex
 *   index={0}
 *   components={{
 *     Text: MyTextComponent,
 *     Image: MyImageComponent
 *   }}
 * />
 * ```
 */
export declare const MessagePrimitivePartByIndex: FC<MessagePrimitivePartByIndex.Props>;
/**
 * Renders the parts of a message with support for multiple content types.
 *
 * This component automatically handles different types of message content including
 * text, images, files, tool calls, and more. It provides a flexible component
 * system for customizing how each content type is rendered.
 *
 * @example
 * ```tsx
 * <MessagePrimitive.Parts
 *   components={{
 *     Text: ({ text }) => <p className="message-text">{text}</p>,
 *     Image: ({ image }) => <img src={image} alt="Message image" />,
 *     tools: {
 *       by_name: {
 *         calculator: CalculatorTool,
 *         weather: WeatherTool,
 *       },
 *       Fallback: DefaultToolComponent
 *     }
 *   }}
 * />
 * ```
 */
export declare const MessagePrimitiveParts: FC<MessagePrimitiveParts.Props>;
//# sourceMappingURL=MessageParts.d.ts.map