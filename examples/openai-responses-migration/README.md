# OpenAI Responses Migration Example

This example uses the normal `create-mastra` layout:

- `src/mastra/` for the Mastra project
- `mastra dev` to start the Mastra server
- a Next app that calls the Mastra server directly from the client with `@mastra/client-js`
- a local `LibSQLStore` so `store: true` and memory-backed follow-up turns work

It is intentionally narrow:

- The app uses `MastraClient.responses.create()` and `MastraClient.responses.stream()`.
- The Mastra agents live in `src/mastra/` inside the example.
- The example focuses on plain text Responses API calls and stored follow-up turns.
- The UI includes three demo modes: `Mastra Agent`, `Mastra Agent + Tool`, and `Provider-backed Agent`.
- The client component calls `MastraClient.responses.create()` and `.stream()` directly so the main request shape is easy to copy.
- The UI stays intentionally small: a sidebar, one prompt field, one response surface, and a raw JSON toggle.

## What this demonstrates

- Non-streaming Responses API calls against Mastra
- Streaming Responses API calls against Mastra
- A `Mastra Agent` path with `store: true` and `previous_response_id`
- A `Mastra Agent + Tool` path that calls a real Mastra tool during the response turn
- A `Provider-backed Agent` path that uses `providerOptions.openai.previousResponseId`
- A standard Mastra app structure instead of a custom embedded server bootstrap
- A compact demo-friendly playground with a sidebar, prompt chips, Enter-to-send, response copying, and expandable raw payloads
- A lightweight chat transcript that makes the difference between stored agent turns and provider-backed continuation visible

## Migration shape

OpenAI SDK against hosted OpenAI:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await client.responses.create({
  model: 'gpt-4.1-mini',
  input: 'Write a short bedtime story.',
});
```

Mastra app code in this example:

```ts
import { MastraClient } from '@mastra/client-js';

const client = new MastraClient({
  baseUrl: process.env.MASTRA_BASE_URL ?? 'http://localhost:4111',
});

const response = await client.responses.create({
  model: 'openai/gpt-4.1-mini',
  agent_id: 'support-agent',
  input: 'Check release readiness for the Responses API migration.',
  store: true,
});
```

The important part is the split:

- `model` is the provider/model string
- `agent_id` is the Mastra agent selector
- `store: true` works on the `Mastra Agent` and `Mastra Agent + Tool` paths
- provider-native continuation still runs through a Mastra agent by reusing `response.providerOptions.openai.responseId`

## Run locally

1. Install dependencies from the example directory.
2. Copy `.env.example` to `.env`.
3. Start the app and the Mastra server together.

```bash
cd examples/openai-responses-migration
pnpm install --ignore-workspace
cp .env.example .env
pnpm dev
```

Then open:

- App: `http://localhost:3000`
- Mastra API: `http://localhost:4111/api`

## Notes

- `OPENAI_API_KEY` is used by the underlying OpenAI model.
- `NEXT_PUBLIC_MASTRA_BASE_URL` points the browser client at the local Mastra dev server.
- `NEXT_PUBLIC_AGENT_MODEL` configures the underlying model used by all demo modes.
- `NEXT_PUBLIC_MASTRA_AGENT_ID` configures the registered agent used by the memory-backed demo mode.
- `NEXT_PUBLIC_MASTRA_TOOL_AGENT_ID` configures the registered agent used by the agent-with-tools demo mode.
- The example persists threads and response IDs in `./mastra.db`.
