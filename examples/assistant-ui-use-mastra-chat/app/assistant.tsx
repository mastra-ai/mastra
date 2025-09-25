"use client";

import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";

import { Thread } from "@/components/assistant-ui/thread";
import { ThreadMessageLike } from "@assistant-ui/react";
import { useMastraChat, toAssistantUIMessage } from "@mastra/react-hooks";
import { useRef } from "react";

export const Assistant = () => {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { setMessages, messages, streamVNext, isRunning, cancelRun } =
    useMastraChat<ThreadMessageLike>({
      agentId: "chefModelV2Agent",
    });

  const runtime = useExternalStoreRuntime({
    isRunning: isRunning,
    messages,
    convertMessage: (message) => message,
    onNew: (message) => {
      if (message.content[0]?.type !== "text")
        throw new Error("Only text messages are supported");

      const input = message.content[0].text;
      setMessages((currentConversation) => [
        ...currentConversation,
        { role: "user", content: input },
      ]);

      abortControllerRef.current = new AbortController();

      return streamVNext({
        coreUserMessages: [{ role: "user", content: input }],
        signal: abortControllerRef.current.signal,
        onChunk: (chunk, conversation) =>
          toAssistantUIMessage({ chunk, conversation }),
      });
    },
    onCancel: async () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      cancelRun?.();
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
