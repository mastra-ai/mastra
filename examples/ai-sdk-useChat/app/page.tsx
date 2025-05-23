'use client';

import { useChat } from '@ai-sdk/react';

export default function Chat() {
  const { messages, input, data, handleInputChange, handleSubmit } = useChat({
    // api: '/api/chat',
    api: '/api/sub-agent-tools',
  });

  return (
    <div className="flex flex-col w-full max-w-md py-24 mx-auto stretch">
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {m.role === 'user' ? 'User: ' : 'AI: '}
          {m.content}
        </div>
      ))}

      {/* Leverage message annotations to display tool calls */}
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {JSON.stringify(m.annotations)}
        </div>
      ))}

      {/* Leverage data parts to display tool calls */}
      {messages.map(m => (
        <div key={m.id} className="whitespace-pre-wrap">
          {JSON.stringify(data)}
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
