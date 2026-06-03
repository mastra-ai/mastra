# Chat with YouTube

An AI assistant that helps you understand YouTube videos. Paste a link and ask questions, get summaries, or generate chapter timestamps — all backed by the actual transcript with clickable citations. Built with [Mastra](https://mastra.ai).

## Why we built this

This template shows how to build a conversational agent with persistent memory that uses custom tools to fetch and analyze external content. It demonstrates tool composition — getting metadata first for context, then fetching the transcript for detailed analysis.

## Features

- Summarize video content with timestamped sections
- Answer questions about what was said in the video
- Generate chapter timestamps for easy navigation
- Find specific moments where topics are discussed
- Clickable timestamp citations that link directly to the video
- Conversational memory to ask follow-up questions

## Prerequisites

- [OpenAI API key](https://platform.openai.com/api-keys) — used by default, but you can swap in any model

## Quickstart

1. **Clone the template**
   - Run `npx create-mastra@latest --template chat-with-youtube` to scaffold the project locally.
2. **Add your API keys**
   - Copy `.env.example` to `.env` and fill in your OpenAI key.
3. **Start the dev server**
   - Run `npm run dev` and open [localhost:4111](http://localhost:4111) to try it out.

## Making it yours

Open Studio and start chatting with the `chat-with-youtube` agent. Paste any YouTube URL and ask for a summary, specific questions about the content, or chapter timestamps. The agent fetches the transcript and responds with citations you can click to jump to that moment in the video.

Swap in a different model, add your own tools for video analysis, or wire the agent into your app using the [Mastra Client SDK](https://mastra.ai/docs/server/mastra-client). The agent and tools are all in `src/` — edit them directly to fit your use case.

## About Mastra templates

[Mastra templates](https://mastra.ai/templates) are ready-to-use projects that show off what you can build — clone one, poke around, and make it yours. They live in the [Mastra monorepo](https://github.com/mastra-ai/mastra) and are automatically synced to standalone repositories for easier cloning.

Want to contribute? See [CONTRIBUTING.md](https://github.com/mastra-ai/mastra/blob/main/templates/template-chat-with-youtube/CONTRIBUTING.md).
