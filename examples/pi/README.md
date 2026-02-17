# Pi + Mastra Observational Memory

Examples showing `@mastra/pi` with Observational Memory for both `pi-agent-core` and `pi-coding-agent`.

## Setup

```bash
cd examples/pi
pnpm install --ignore-workspace
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env
```

## pi-agent-core — Interactive Chat

A standalone conversational agent with OM. As you chat, OM compresses long conversations into structured observations so the agent never loses context.

```bash
pnpm dev                # Chat with the agent
pnpm dev:status         # Chat with OM status after each turn
```

Commands: `/status` `/obs` `/clear` `/quit`

See [`src/index.ts`](src/index.ts).

## pi-coding-agent — Extension

The `.pi/` directory is pre-configured with the OM extension:

```bash
pnpm coding-agent
```

- [`.pi/extensions/mastra-om.ts`](.pi/extensions/mastra-om.ts) — loads the extension
- [`.pi/mastra.json`](.pi/mastra.json) — OM config (model, thresholds)

Once loaded, the extension registers `memory_status` and `memory_observations` tools.

To use custom config overrides instead of the JSON file:

```ts
// .pi/extensions/mastra-om.ts
import { createMastraOMExtension } from '@mastra/pi/extension';

export default createMastraOMExtension({
  model: 'anthropic/claude-sonnet-4-20250514',
  observation: { messageTokens: 50_000 },
});
```
