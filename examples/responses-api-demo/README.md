# Responses API Demo

This example uses the normal `create-mastra` layout:

- `src/mastra/` for the Mastra project
- `mastra dev` to start the Mastra server
- a Next app that calls the Mastra server directly from the client with `@mastra/client-js`
- a local `LibSQLStore` so `store: true` and memory-backed follow-up turns work

It is intentionally narrow:

- Each demo mode lives in its own component so the request shape is easy to read and copy.
- The app uses `MastraClient.responses.create()` and `MastraClient.responses.stream()`.
- The app also includes an `OpenAI` SDK compatibility mode that points `baseURL` at the Mastra server.
- The Mastra agents live in `src/mastra/` inside the example.
- The example focuses on plain text Responses API calls, stored follow-up turns, and conversations.
- The UI includes dedicated modes for agent responses, agent + tool responses, conversations, OpenAI SDK compatibility, and provider-backed continuation.
- The UI stays intentionally small: a sidebar, one prompt field, one response surface, and a raw JSON toggle.

## What this demonstrates

- Non-streaming Responses API calls against Mastra
- Streaming Responses API calls against Mastra
- A `Mastra Agent` path with `store: true` and `previous_response_id`
- A `Mastra Agent + Tool` path that calls a real Mastra tool during the response turn
- A `Provider-backed Agent` path that uses `providerOptions.openai.previousResponseId`
- A `Mastra via OpenAI SDK` path that uses `openai.responses.create(...)` against the Mastra server
- A `Conversations` path that can create, load, and delete stored conversations
- A standard Mastra app structure instead of a custom embedded server bootstrap
- A compact demo-friendly playground with a sidebar, prompt chips, Enter-to-send, response copying, and expandable raw payloads
- A lightweight chat transcript that makes the difference between stored agent turns and provider-backed continuation visible

## API shape

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
  input: 'Check release readiness for the Responses API demo.',
  store: true,
});
```

OpenAI SDK against Mastra:

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'mastra-demo-key',
  baseURL: 'http://localhost:4111/api/v1',
  dangerouslyAllowBrowser: true,
});

const response = await client.responses.create({
  model: 'openai/gpt-4.1-mini',
  agent_id: 'support-agent',
  input: 'Check release readiness for the Responses API demo.',
  store: true,
} as any);
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
cd examples/responses-api-demo
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
- The demo uses built-in example agent IDs: `support-agent` and `tool-agent`.
- The example persists threads and response IDs in `./mastra.db`.
