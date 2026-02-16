# @mastra/pi

Mastra [Observational Memory](https://mastra.ai/docs/memory/observational-memory) integration for the [Pi agent framework](https://github.com/badlogic/pi-mono).

Observational Memory compresses long conversation history into structured observations using an Observer (extract) and Reflector (condense) architecture. This package brings that capability to Pi agents.

## Supported Pi packages

| Package | Integration |
| --- | --- |
| `@mariozechner/pi-agent-core` | `createMastraOM()` — plugs into `Agent({ transformContext })` |
| `@mariozechner/pi-coding-agent` | `mastraOMExtension` — full extension with lifecycle hooks and diagnostic tools |

## Installation

```bash
pnpm add @mastra/pi @mastra/memory @mastra/core
```

You also need a storage adapter. Pick one:

```bash
# LibSQL (local SQLite or Turso)
pnpm add @mastra/libsql

# Postgres
pnpm add @mastra/pg

# Or any other Mastra storage adapter
```

And the Pi agent package(s) you're targeting:

```bash
pnpm add @mariozechner/pi-agent-core
# and/or
pnpm add @mariozechner/pi-coding-agent
```

## Usage: pi-agent-core

Bring your own storage and pass it to `createMastraOM`. The function returns helpers that plug directly into the Pi `Agent` constructor.

```ts
import { Agent } from '@mariozechner/pi-agent-core';
import { getModel } from '@mariozechner/pi-ai';
import { createMastraOM } from '@mastra/pi';
import { LibSQLStore } from '@mastra/libsql';

// 1. Initialize storage
const store = new LibSQLStore({ url: 'file:memory.db' });
await store.init();
const storage = await store.getStore('memory');

// 2. Create the OM integration
const om = createMastraOM({
  storage,
  model: 'google/gemini-2.5-flash',
  observation: { messageTokens: 30_000 },
  reflection: { observationTokens: 40_000 },
});

// 3. Wire into the Pi Agent
const sessionId = 'session-1';
await om.initSession(sessionId);

const agent = new Agent({
  initialState: {
    systemPrompt: await om.wrapSystemPrompt('You are a helpful assistant.', sessionId),
    model: getModel('anthropic', 'claude-sonnet-4-20250514'),
  },
  transformContext: om.createTransformContext(sessionId),
});

await agent.prompt('Hello!');
```

### Any storage adapter works

```ts
// Postgres
import { PgStore } from '@mastra/pg';
const store = new PgStore({ connectionString: process.env.DATABASE_URL });
await store.init();
const storage = await store.getStore('memory');
const om = createMastraOM({ storage });

// In-memory (great for testing)
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
const storage = new InMemoryMemory({ db: new InMemoryDB() });
const om = createMastraOM({ storage, model: 'google/gemini-2.5-flash' });
```

### `createMastraOM` options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `storage` | `MemoryStorage` | **required** | Any Mastra storage adapter |
| `model` | `string` | `'google/gemini-2.5-flash'` | Model for Observer and Reflector agents |
| `observation` | `ObservationConfig` | — | Observation step config (thresholds, model overrides) |
| `reflection` | `ReflectionConfig` | — | Reflection step config |
| `scope` | `'thread' \| 'resource'` | `'thread'` | Per-thread or cross-thread observations |
| `shareTokenBudget` | `boolean` | `false` | Flexible allocation between messages and observations |
| `onDebugEvent` | `function` | — | Debug callback for observation events |

### `MastraOMIntegration` methods

| Method | Description |
| --- | --- |
| `createTransformContext(sessionId, hooks?)` | Returns a `transformContext` function for `Agent` |
| `wrapSystemPrompt(basePrompt, sessionId)` | Appends observation context to a system prompt |
| `getSystemPromptBlock(sessionId)` | Returns just the observations block |
| `getStatus(sessionId, messages?)` | Formatted diagnostic string |
| `getObservations(sessionId)` | Raw observation text |
| `initSession(sessionId)` | Eagerly create the OM record |

## Usage: pi-coding-agent

The extension hooks into the coding agent's lifecycle automatically. Create a file in your project's `.pi/extensions/` directory:

```ts
// .pi/extensions/mastra-om.ts
import { mastraOMExtension } from '@mastra/pi/extension';
export default mastraOMExtension;
```

That's it. The extension will:

- **Initialize** OM records on `session_start`
- **Observe** conversation on each `context` event, filtering out already-observed messages
- **Inject** observations into the system prompt via `before_agent_start`
- **Register** `memory_status` and `memory_observations` diagnostic tools

### Configuration

Create `.pi/mastra.json` in your project root:

```json
{
  "model": "google/gemini-2.5-flash",
  "observation": {
    "messageTokens": 20000
  },
  "reflection": {
    "observationTokens": 90000
  },
  "storagePath": ".pi/memory/observations.db"
}
```

All fields are optional — defaults match the table above.

### Custom config overrides

```ts
// .pi/extensions/mastra-om.ts
import { createMastraOMExtension } from '@mastra/pi/extension';

export default createMastraOMExtension({
  model: 'anthropic/claude-sonnet-4-20250514',
  observation: { messageTokens: 50_000 },
});
```

### Convenience: `createMastraOMFromConfig`

If you want the file-based config + LibSQLStore convenience path outside the extension system:

```ts
import { createMastraOMFromConfig } from '@mastra/pi';

const om = await createMastraOMFromConfig({ cwd: process.cwd() });
```

This reads `.pi/mastra.json` and creates a LibSQLStore automatically. Requires `@mastra/libsql` to be installed.

## How it works

Observational Memory uses a three-agent architecture:

1. **Actor** (your main agent) — sees observations + recent unobserved messages
2. **Observer** — extracts structured observations when unobserved message tokens exceed a threshold
3. **Reflector** — condenses observations when they grow too large

This achieves 5-40x compression of conversation history, allowing agents to maintain context across very long sessions without hitting context window limits.

## Testing

```bash
pnpm vitest run
```

Tests use `InMemoryMemory` from `@mastra/core/storage` with mock observer models — no API keys or external services needed.

## License

Apache-2.0
