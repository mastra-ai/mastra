"use client";

import { useState } from "react";
import { chat } from "./actions";
import { readStreamableValue } from "@ai-sdk/rsc";
import { type UIMessageWithMetadata } from "@mastra/core/agent";

export default function Chat({
  initialMessages,
}: {
  initialMessages: UIMessageWithMetadata[];
}) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(initialMessages);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map((m) => (
        <div
          key={m.id}
          className="whitespace-pre-wrap"
          style={{ marginTop: "1em" }}
        >
          <h3
            style={{
              fontWeight: "bold",
              color: m.role === "user" ? "green" : "yellow",
            }}
          >
            {m.role === "user" ? "User: " : "AI: "}
          </h3>
          {m.parts.map((p, i) => {
            if (p.type === "text") {
              return <span key={i}>{p.text}</span>;
            }
            return null;
          })}
        </div>
      ))}

      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (input.trim()) {
            setLoading(true);

            const { history, text } = await chat(input);

            setMessages(() => {
              return [
                ...history,
                {
                  id: crypto.randomUUID(),
                  role: "user",
                  parts: [{ type: "text", text: input }],
                  metadata: {},
                  content: input,
                },
                {
                  id: crypto.randomUUID(),
                  role: "assistant",
                  parts: [{ type: "text", text: "" }],
                  metadata: {},
                  content: "",
                },
              ];
            });

            setInput("");

            for await (const latest of readStreamableValue(text)) {
              if (!latest) {
                continue;
              }

              setMessages((prev) => {
                let lastMessage = prev[prev.length - 1];
                lastMessage.content = latest;
                if (
                  lastMessage.parts[lastMessage.parts.length - 1].type ===
                  "text"
                ) {
                  (
                    lastMessage.parts[lastMessage.parts.length - 1] as {
                      text: string;
                    }
                  ).text = latest;
                }

                return [...prev.slice(0, -1), lastMessage];
              });
            }

            setLoading(false);
          }
        }}
      >
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="Ask about the weather..."
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
      </form>
    </div>
  );
}
