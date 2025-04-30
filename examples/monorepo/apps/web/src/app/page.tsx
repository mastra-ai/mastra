"use client"

import Image from "next/image";
import { askQuestion } from "./action-ask";
import { useState } from "react";

export default function Home() {
  "use client";
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const { answer } = await askQuestion(query);
    setAnswer(answer);
    setLoading(false);
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 justify-between">
      <div className="p-6 flex-1 flex flex-col items-center justify-start">
        <div className="w-full max-w-xl bg-white rounded-lg shadow p-6 mb-8 min-h-[100px] flex items-center justify-center text-lg text-gray-800">
          {answer ? answer : <span className="text-gray-500">Your answer will appear here</span>}
        </div>
      </div>
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-xl mx-auto p-4 flex gap-2 items-center bg-white border-t border-gray-200"
      >
        <input
          type="text"
          name="query"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Ask a question..."
          className="text-black flex-1 rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white rounded-lg px-4 py-2 font-semibold hover:bg-blue-600 disabled:opacity-50"
          disabled={loading || !query}
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>
    </div>
  );
}
