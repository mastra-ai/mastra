# Electron Chat with Mastra

A desktop chat application built with Electron and React, connected to a Mastra AI agent backend using AI SDK UI.

## Prerequisites

- Node.js v22.13.0 or later
- A Groq API key (the bundled agent uses `groq/llama-3.3-70b-versatile`)

## Getting Started

1. Install dependencies:

```bash
pnpm install
```

2. Create a `.env` file from the example and add your API key:

```bash
cp .env.example .env
```

Then edit `.env` and set your Groq API key:

```
GROQ_API_KEY=your-actual-api-key
```

3. Start the Mastra server (runs on `http://localhost:4111`):

```bash
pnpm mastra:dev
```

4. In a separate terminal, start the Electron app:

```bash
pnpm dev
```

The Electron window opens and connects to `http://localhost:4111/chat/weatherAgent`. You can change the agent ID in `src/renderer/src/App.tsx`.

## Project Structure

```
electron-chat/
├── src/
│   ├── mastra/              # Mastra server (agents, tools, scorers)
│   │   ├── index.ts
│   │   ├── agents/
│   │   ├── tools/
│   │   └── scorers/
│   ├── main/                # Electron main process
│   ├── preload/             # Electron preload script
│   └── renderer/            # React chat UI
├── .env.example
├── electron.vite.config.ts
└── package.json
```

## How It Works

The Electron main process creates a `BrowserWindow` that loads the React renderer. The renderer uses `useChat()` from `@ai-sdk/react` with a `DefaultChatTransport` to stream messages from the Mastra server's `/chat/:agentId` endpoint.

## Learn More

- [Electron guide](https://mastra.ai/en/guides/build-your-ui/electron) in the Mastra docs
- [Agents overview](https://mastra.ai/en/docs/agents/overview)
- [AI SDK UI guide](https://mastra.ai/en/guides/build-your-ui/ai-sdk-ui)
