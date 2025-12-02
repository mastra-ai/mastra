"use client";

// src/primitives/thread/ThreadMessages.tsx
import { memo, useMemo } from "react";
import { useThread, useThreadRuntime } from "../../context/react/ThreadContext.js";
import { MessageRuntimeProvider } from "../../context/providers/MessageRuntimeProvider.js";
import { useEditComposer, useMessage } from "../../context/index.js";
import { jsx } from "react/jsx-runtime";
var isComponentsSame = (prev, next) => {
  return prev.Message === next.Message && prev.EditComposer === next.EditComposer && prev.UserEditComposer === next.UserEditComposer && prev.AssistantEditComposer === next.AssistantEditComposer && prev.SystemEditComposer === next.SystemEditComposer && prev.UserMessage === next.UserMessage && prev.AssistantMessage === next.AssistantMessage && prev.SystemMessage === next.SystemMessage;
};
var DEFAULT_SYSTEM_MESSAGE = () => null;
var getComponent = (components, role, isEditing) => {
  switch (role) {
    case "user":
      if (isEditing) {
        return components.UserEditComposer ?? components.EditComposer ?? components.UserMessage ?? components.Message;
      } else {
        return components.UserMessage ?? components.Message;
      }
    case "assistant":
      if (isEditing) {
        return components.AssistantEditComposer ?? components.EditComposer ?? components.AssistantMessage ?? components.Message;
      } else {
        return components.AssistantMessage ?? components.Message;
      }
    case "system":
      if (isEditing) {
        return components.SystemEditComposer ?? components.EditComposer ?? components.SystemMessage ?? components.Message;
      } else {
        return components.SystemMessage ?? DEFAULT_SYSTEM_MESSAGE;
      }
    default:
      const _exhaustiveCheck = role;
      throw new Error(`Unknown message role: ${_exhaustiveCheck}`);
  }
};
var ThreadMessageComponent = ({
  components
}) => {
  const role = useMessage((m) => m.role);
  const isEditing = useEditComposer((c) => c.isEditing);
  const Component = getComponent(components, role, isEditing);
  return /* @__PURE__ */ jsx(Component, {});
};
var ThreadPrimitiveMessageByIndex = memo(
  ({ index, components }) => {
    const threadRuntime = useThreadRuntime();
    const runtime = useMemo(
      () => threadRuntime.getMesssageByIndex(index),
      [threadRuntime, index]
    );
    return /* @__PURE__ */ jsx(MessageRuntimeProvider, { runtime, children: /* @__PURE__ */ jsx(ThreadMessageComponent, { components }) });
  },
  (prev, next) => prev.index === next.index && isComponentsSame(prev.components, next.components)
);
ThreadPrimitiveMessageByIndex.displayName = "ThreadPrimitive.MessageByIndex";
var ThreadPrimitiveMessagesImpl = ({
  components
}) => {
  const messagesLength = useThread((t) => t.messages.length);
  const messageElements = useMemo(() => {
    if (messagesLength === 0) return null;
    return Array.from({ length: messagesLength }, (_, index) => /* @__PURE__ */ jsx(
      ThreadPrimitiveMessageByIndex,
      {
        index,
        components
      },
      index
    ));
  }, [messagesLength, components]);
  return messageElements;
};
ThreadPrimitiveMessagesImpl.displayName = "ThreadPrimitive.Messages";
var ThreadPrimitiveMessages = memo(
  ThreadPrimitiveMessagesImpl,
  (prev, next) => isComponentsSame(prev.components, next.components)
);
export {
  ThreadPrimitiveMessageByIndex,
  ThreadPrimitiveMessages,
  ThreadPrimitiveMessagesImpl
};
//# sourceMappingURL=ThreadMessages.js.map