"use client";

import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithToolCalls,
} from "ai";
import useSWR from "swr";

const THREAD_ID = "demo-thread-1";
const RESOURCE_ID = "demo-user";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Chat() {
  const { data: initialMessages = [] } = useSWR<UIMessage[]>(
    `/api/messages?threadId=${THREAD_ID}`,
    fetcher,
  );

  const { sendMessage, messages, addToolOutput, status, setMessages } = useChat(
    {
      transport: new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest({ messages }) {
          return {
            body: {
              messages,
              memory: { thread: THREAD_ID, resource: RESOURCE_ID },
            },
          };
        },
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      onToolCall({ toolCall }) {
        if (toolCall.toolName === "getCurrentTimeTool") {
          const now = new Date();
          addToolOutput({
            toolCallId: toolCall.toolCallId,
            tool: toolCall.toolName,
            output: {
              iso: now.toISOString(),
              formatted: now.toLocaleString(),
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
          });
        }
      },
    },
  );

  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  const [input, setInput] = useState("");

  return (
    <div className="flex flex-col h-screen max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">
        AI SDK v5 — Weather &amp; Client-Side Tools
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        Try: &quot;What&apos;s the weather in NYC?&quot; (server tool) or
        &quot;What time is it?&quot; (client tool)
      </p>

      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`p-3 rounded-lg ${
              message.role === "user"
                ? "bg-blue-100 ml-auto max-w-[80%]"
                : "bg-gray-100 mr-auto max-w-[80%]"
            }`}
          >
            <div className="text-xs text-gray-500 mb-1">{message.role}</div>
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return (
                  <p key={i} className="whitespace-pre-wrap">
                    {part.text}
                  </p>
                );
              }
              if (isToolUIPart(part)) {
                return (
                  <div key={i} className="text-xs bg-white p-2 rounded mt-1">
                    <span className="font-mono">
                      {part.type.replace("tool-", "")}
                    </span>
                    {part.state === "output-available" && (
                      <span className="ml-2 text-green-600">
                        {JSON.stringify(part.output)}
                      </span>
                    )}
                  </div>
                );
              }
              return null;
            })}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) {
            sendMessage({
              role: "user",
              parts: [{ type: "text", text: input }],
            });
            setInput("");
          }
        }}
        className="flex gap-2"
      >
        <input
          className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={input}
          placeholder="Ask about the weather or the time..."
          onChange={(e) => setInput(e.target.value)}
          disabled={status === "streaming"}
        />
        <button
          type="submit"
          disabled={status === "streaming"}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
