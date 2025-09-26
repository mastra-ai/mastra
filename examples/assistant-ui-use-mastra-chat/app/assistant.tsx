"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";

import { Thread } from "@/components/assistant-ui/thread";
import { ThreadMessageLike } from "@assistant-ui/react";
import { useMastraChat, toAssistantUIMessage } from "@mastra/react-hooks";

export const Assistant = () => {
  const { setMessages, messages, streamVNext, isRunning, cancelRun } =
    useMastraChat<ThreadMessageLike>({
      agentId: "chefModelV2Agent",
    });

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning: isRunning,
    onCancel: cancelRun,
    convertMessage: (message) => message,
    onNew: (message) => {
      if (message.content[0]?.type !== "text")
        throw new Error("Only text messages are supported");

      const input = message.content[0].text;

      setMessages((currentConversation) => [
        ...currentConversation,
        { role: "user", content: input },
      ]);

      return streamVNext({
        coreUserMessages: [{ role: "user", content: input }],
        onChunk: toAssistantUIMessage,
      });
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex-1 overflow-hidden">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
