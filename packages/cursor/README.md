# @mastra/cursor

`@mastra/cursor` connects Mastra to the Cursor SDK. Use it when you want to register a Cursor SDK agent with Mastra and call it through Mastra-compatible `generate()` and `stream()` methods.

## Installation

```bash
npm install @mastra/cursor @cursor/sdk
```

## Overview

The package exports `CursorSDKAgent`, a Mastra `Agent` wrapper around a Cursor SDK agent.

`CursorSDKAgent` keeps the Cursor SDK run loop in charge. Mastra receives compatible outputs, usage data, and tracing data for the run.

## Create a Cursor SDK agent

Create the Cursor SDK agent with `Agent.create()`, then pass that promise to `CursorSDKAgent`.

```typescript
import { Agent as CursorAgent } from '@cursor/sdk';
import { CursorSDKAgent } from '@mastra/cursor';

export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  name: 'Cursor SDK Agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: CursorAgent.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: 'gpt-5.5' },
    local: {
      cwd: process.cwd(),
    },
  }),
});
```

You can also pass the `Agent.create` factory to let the wrapper create the SDK agent. This keeps the vendor SDK import in your app while allowing `CursorSDKAgent` to hydrate defaults such as `apiKey`.

```typescript
export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: CursorAgent.create,
  model: { id: 'gpt-5.5' },
  local: {
    cwd: process.cwd(),
  },
});
```

You can register the wrapper anywhere Mastra accepts an `Agent`.

```typescript
import { Mastra } from '@mastra/core/mastra';

export const mastra = new Mastra({
  agents: {
    cursorAgent,
  },
});
```

## Run the agent

```typescript
const result = await cursorAgent.generate('Find and explain the failing test.', {
  runId: 'cursor-run',
});

console.log(result.text);
```

```typescript
const stream = await cursorAgent.stream('Inspect this repository and suggest the smallest fix.');

for await (const chunk of stream.fullStream) {
  if (chunk.type === 'text-delta') {
    process.stdout.write(chunk.payload.text);
  }
}
```

## Configure Cursor

When you pass `CursorAgent.create({...})` directly, put Cursor create options in that call.

`CursorSDKAgent` also forwards Cursor create options when `agent` is a factory. These include `apiKey`, `model`, `local`, `cloud`, `mcpServers`, `agents`, `agentId`, `idempotencyKey`, and `platform`.

`apiKey` defaults to `process.env.CURSOR_API_KEY` when it is not provided.

Pass `sendOptions` to forward options to each Cursor `agent.send()` call. Mastra wraps `onDelta` so it can collect usage while preserving your callback.

```typescript
export const cursorAgent = new CursorSDKAgent({
  id: 'cursor-sdk-agent',
  description: 'Use Cursor Agent SDK through Mastra.',
  agent: CursorAgent.create({
    apiKey: process.env.CURSOR_API_KEY,
    model: { id: 'gpt-5.5' },
    local: {
      cwd: process.cwd(),
    },
  }),
  sendOptions: {
    onDelta: ({ update }) => {
      console.log('cursor update', update.type);
    },
  },
});
```
