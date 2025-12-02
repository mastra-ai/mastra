"use client";
import { ThreadState } from "../../api";
import { useMessagePart, useMessage } from "../../context";
import { ThreadMessage } from "../../types";
import {
  useExternalMessageConverter,
  convertExternalMessages,
} from "./external-message-converter";
import { getExternalStoreMessages } from "./getExternalStoreMessage";

export const createMessageConverter = <T extends object>(
  callback: useExternalMessageConverter.Callback<T>,
) => {
  const result = {
    useThreadMessages: ({
      messages,
      isRunning,
      joinStrategy,
    }: {
      messages: T[];
      isRunning: boolean;
      joinStrategy?: "concat-content" | "none" | undefined;
    }) => {
      return useExternalMessageConverter<T>({
        callback,
        messages,
        isRunning,
        joinStrategy,
      });
    },
    toThreadMessages: (messages: T[]) => {
      return convertExternalMessages(messages, callback, false); // TODO figure out isRunning
    },
    toOriginalMessages: (
      input: ThreadState | ThreadMessage | ThreadMessage["content"][number],
    ) => {
      const messages = getExternalStoreMessages(input);
      if (messages.length === 0) throw new Error("No original messages found");
      return messages;
    },
    toOriginalMessage: (
      input: ThreadState | ThreadMessage | ThreadMessage["content"][number],
    ) => {
      const messages = result.toOriginalMessages(input);
      return messages[0]!;
    },
    useOriginalMessage: () => {
      const messageMessages = result.useOriginalMessages();
      const first = messageMessages[0]!;
      return first;
    },
    useOriginalMessages: () => {
      const MessagePartMessages = useMessagePart<T[]>({
        optional: true,
        selector: getExternalStoreMessages,
      });

      const messageMessages = useMessage<T[]>(getExternalStoreMessages);
      const messages = MessagePartMessages ?? messageMessages;
      if (messages.length === 0) throw new Error("No original messages found");
      return messages;
    },
  };

  return result;
};
