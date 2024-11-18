'use client';

import { useState } from 'react';

import { testText } from '@/app/actions';

function testStream(messages: string[]) {
  return fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ messages }),
  });
}

export default function Result() {
  const [result, setResult] = useState<string[]>([]);
  const [input, setInput] = useState<string>('');
  const [textResult, setTextResult] = useState<string | undefined>(undefined);

  async function fetchStream() {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [input] }),
    });
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) return;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      setResult(prev => [...prev, text]);
    }
  }

  return (
    <div>
      <p>Test Text</p>
      <button className="bg-blue-500 text-white p-2 rounded" onClick={() => testText([input]).then(setTextResult)}>
        Test Text
      </button>
      <p>{textResult}</p>

      <input
        className="border text-black border-gray-300 rounded p-2"
        type="text"
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <button className="bg-blue-500 ml-4 text-white p-2 rounded" onClick={() => fetchStream()}>
        Test Stream
      </button>
      <div>
        {result.map((message, index) => (
          <div key={index}>{message}</div>
        ))}
      </div>
    </div>
  );
}
