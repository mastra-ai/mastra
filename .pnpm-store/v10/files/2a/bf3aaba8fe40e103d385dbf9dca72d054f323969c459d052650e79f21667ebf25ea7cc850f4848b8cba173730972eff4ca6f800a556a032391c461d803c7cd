import { type ComponentType, type FC } from "react";
export declare namespace ThreadPrimitiveMessages {
    type Props = {
        /**
         * Component configuration for rendering different types of messages and composers.
         *
         * You can provide either:
         * 1. A single `Message` component that handles all message types
         * 2. Specific components for `UserMessage` and `AssistantMessage` (with optional `SystemMessage`)
         *
         * Optional edit composer components can be provided to customize the editing experience
         * for different message types when users edit their messages.
         */
        components: {
            /** Component used to render all message types */
            Message: ComponentType;
            /** Component used when editing any message type */
            EditComposer?: ComponentType | undefined;
            /** Component used when editing user messages specifically */
            UserEditComposer?: ComponentType | undefined;
            /** Component used when editing assistant messages specifically */
            AssistantEditComposer?: ComponentType | undefined;
            /** Component used when editing system messages specifically */
            SystemEditComposer?: ComponentType | undefined;
            /** Component used to render user messages specifically */
            UserMessage?: ComponentType | undefined;
            /** Component used to render assistant messages specifically */
            AssistantMessage?: ComponentType | undefined;
            /** Component used to render system messages specifically */
            SystemMessage?: ComponentType | undefined;
        } | {
            /** Component used to render all message types (fallback) */
            Message?: ComponentType | undefined;
            /** Component used when editing any message type */
            EditComposer?: ComponentType | undefined;
            /** Component used when editing user messages specifically */
            UserEditComposer?: ComponentType | undefined;
            /** Component used when editing assistant messages specifically */
            AssistantEditComposer?: ComponentType | undefined;
            /** Component used when editing system messages specifically */
            SystemEditComposer?: ComponentType | undefined;
            /** Component used to render user messages */
            UserMessage: ComponentType;
            /** Component used to render assistant messages */
            AssistantMessage: ComponentType;
            /** Component used to render system messages */
            SystemMessage?: ComponentType | undefined;
        };
    };
}
export declare namespace ThreadPrimitiveMessageByIndex {
    type Props = {
        index: number;
        components: ThreadPrimitiveMessages.Props["components"];
    };
}
/**
 * Renders a single message at the specified index in the current thread.
 *
 * This component provides message context for a specific message in the thread
 * and renders it using the provided component configuration.
 *
 * @example
 * ```tsx
 * <ThreadPrimitive.MessageByIndex
 *   index={0}
 *   components={{
 *     UserMessage: MyUserMessage,
 *     AssistantMessage: MyAssistantMessage
 *   }}
 * />
 * ```
 */
export declare const ThreadPrimitiveMessageByIndex: FC<ThreadPrimitiveMessageByIndex.Props>;
/**
 * Renders all messages in the current thread using the provided component configuration.
 *
 * This component automatically renders all messages in the thread, providing the appropriate
 * message context for each message. It handles different message types (user, assistant, system)
 * and supports editing mode through the provided edit composer components.
 *
 * @example
 * ```tsx
 * <ThreadPrimitive.Messages
 *   components={{
 *     UserMessage: MyUserMessage,
 *     AssistantMessage: MyAssistantMessage,
 *     EditComposer: MyEditComposer
 *   }}
 * />
 * ```
 */
export declare const ThreadPrimitiveMessagesImpl: FC<ThreadPrimitiveMessages.Props>;
export declare const ThreadPrimitiveMessages: import("react").NamedExoticComponent<ThreadPrimitiveMessages.Props>;
//# sourceMappingURL=ThreadMessages.d.ts.map