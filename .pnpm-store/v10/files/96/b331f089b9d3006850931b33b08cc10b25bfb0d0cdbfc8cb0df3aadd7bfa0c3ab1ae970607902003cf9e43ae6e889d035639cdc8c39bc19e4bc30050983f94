"use client";

// src/runtimes/external-store/createMessageConverter.tsx
import { useMessagePart, useMessage } from "../../context/index.js";
import {
  useExternalMessageConverter,
  convertExternalMessages
} from "./external-message-converter.js";
import { getExternalStoreMessages } from "./getExternalStoreMessage.js";
var createMessageConverter = (callback) => {
  const result = {
    useThreadMessages: ({
      messages,
      isRunning,
      joinStrategy
    }) => {
      return useExternalMessageConverter({
        callback,
        messages,
        isRunning,
        joinStrategy
      });
    },
    toThreadMessages: (messages) => {
      return convertExternalMessages(messages, callback, false);
    },
    toOriginalMessages: (input) => {
      const messages = getExternalStoreMessages(input);
      if (messages.length === 0) throw new Error("No original messages found");
      return messages;
    },
    toOriginalMessage: (input) => {
      const messages = result.toOriginalMessages(input);
      return messages[0];
    },
    useOriginalMessage: () => {
      const messageMessages = result.useOriginalMessages();
      const first = messageMessages[0];
      return first;
    },
    useOriginalMessages: () => {
      const MessagePartMessages = useMessagePart({
        optional: true,
        selector: getExternalStoreMessages
      });
      const messageMessages = useMessage(getExternalStoreMessages);
      const messages = MessagePartMessages ?? messageMessages;
      if (messages.length === 0) throw new Error("No original messages found");
      return messages;
    }
  };
  return result;
};
export {
  createMessageConverter
};
//# sourceMappingURL=createMessageConverter.js.map