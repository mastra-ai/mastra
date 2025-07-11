"use client";

import { Message, useChat } from "@ai-sdk/react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function Chat() {
  const { data: initialMessages = [] } = useSWR<Message[]>(
    "/api/initial-chat",
    fetcher,
  );
  const { messages, input, handleInputChange, handleSubmit } = useChat({
    initialMessages,
  });

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
          {m.parts.map((p) => p.type === "text" && p.text).join("\n")}
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input
          className="fixed dark:bg-zinc-900 bottom-0 w-full max-w-md p-2 mb-8 border border-zinc-300 dark:border-zinc-800 rounded shadow-xl"
          value={input}
          placeholder="Say something..."
          onChange={handleInputChange}
        />
      </form>
    </div>
  );
}
