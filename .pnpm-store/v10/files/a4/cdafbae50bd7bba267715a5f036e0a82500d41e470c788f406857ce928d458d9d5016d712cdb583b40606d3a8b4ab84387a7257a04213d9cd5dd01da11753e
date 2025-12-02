"use client";

import { type ComponentType, type FC, memo, useMemo } from "react";
import { useThread, useThreadRuntime } from "../../context/react/ThreadContext";
import { MessageRuntimeProvider } from "../../context/providers/MessageRuntimeProvider";
import { useEditComposer, useMessage } from "../../context";
import { ThreadMessage as ThreadMessageType } from "../../types";

export namespace ThreadPrimitiveMessages {
  export type Props = {
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
    components:
      | {
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
        }
      | {
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

const isComponentsSame = (
  prev: ThreadPrimitiveMessages.Props["components"],
  next: ThreadPrimitiveMessages.Props["components"],
) => {
  return (
    prev.Message === next.Message &&
    prev.EditComposer === next.EditComposer &&
    prev.UserEditComposer === next.UserEditComposer &&
    prev.AssistantEditComposer === next.AssistantEditComposer &&
    prev.SystemEditComposer === next.SystemEditComposer &&
    prev.UserMessage === next.UserMessage &&
    prev.AssistantMessage === next.AssistantMessage &&
    prev.SystemMessage === next.SystemMessage
  );
};

const DEFAULT_SYSTEM_MESSAGE = () => null;

const getComponent = (
  components: ThreadPrimitiveMessages.Props["components"],
  role: ThreadMessageType["role"],
  isEditing: boolean,
) => {
  switch (role) {
    case "user":
      if (isEditing) {
        return (
          components.UserEditComposer ??
          components.EditComposer ??
          components.UserMessage ??
          (components.Message as ComponentType)
        );
      } else {
        return components.UserMessage ?? (components.Message as ComponentType);
      }
    case "assistant":
      if (isEditing) {
        return (
          components.AssistantEditComposer ??
          components.EditComposer ??
          components.AssistantMessage ??
          (components.Message as ComponentType)
        );
      } else {
        return (
          components.AssistantMessage ?? (components.Message as ComponentType)
        );
      }
    case "system":
      if (isEditing) {
        return (
          components.SystemEditComposer ??
          components.EditComposer ??
          components.SystemMessage ??
          (components.Message as ComponentType)
        );
      } else {
        return components.SystemMessage ?? DEFAULT_SYSTEM_MESSAGE;
      }
    default:
      const _exhaustiveCheck: never = role;
      throw new Error(`Unknown message role: ${_exhaustiveCheck}`);
  }
};

type ThreadMessageComponentProps = {
  components: ThreadPrimitiveMessages.Props["components"];
};

const ThreadMessageComponent: FC<ThreadMessageComponentProps> = ({
  components,
}) => {
  const role = useMessage((m) => m.role);
  const isEditing = useEditComposer((c) => c.isEditing);
  const Component = getComponent(components, role, isEditing);

  return <Component />;
};
export namespace ThreadPrimitiveMessageByIndex {
  export type Props = {
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
export const ThreadPrimitiveMessageByIndex: FC<ThreadPrimitiveMessageByIndex.Props> =
  memo(
    ({ index, components }) => {
      const threadRuntime = useThreadRuntime();
      const runtime = useMemo(
        () => threadRuntime.getMesssageByIndex(index),
        [threadRuntime, index],
      );

      return (
        <MessageRuntimeProvider runtime={runtime}>
          <ThreadMessageComponent components={components} />
        </MessageRuntimeProvider>
      );
    },
    (prev, next) =>
      prev.index === next.index &&
      isComponentsSame(prev.components, next.components),
  );

ThreadPrimitiveMessageByIndex.displayName = "ThreadPrimitive.MessageByIndex";

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
export const ThreadPrimitiveMessagesImpl: FC<ThreadPrimitiveMessages.Props> = ({
  components,
}) => {
  const messagesLength = useThread((t) => t.messages.length);

  const messageElements = useMemo(() => {
    if (messagesLength === 0) return null;
    return Array.from({ length: messagesLength }, (_, index) => (
      <ThreadPrimitiveMessageByIndex
        key={index}
        index={index}
        components={components}
      />
    ));
  }, [messagesLength, components]);

  return messageElements;
};

ThreadPrimitiveMessagesImpl.displayName = "ThreadPrimitive.Messages";

export const ThreadPrimitiveMessages = memo(
  ThreadPrimitiveMessagesImpl,
  (prev, next) => isComponentsSame(prev.components, next.components),
);
