# @mastra/inngest

`@mastra/inngest` connects Mastra workflows and agents to Inngest for durable execution, retries, and step memoization. Use `init()` to create Inngest-backed workflow primitives, or `createInngestAgent()` when an agent run must survive process restarts and transient failures.

## Installation

```bash
npm install @mastra/inngest
```

## Usage

```typescript
import { Inngest } from 'inngest';
import { init } from '@mastra/inngest';

const inngest = new Inngest({ id: 'my-app' });
const { createWorkflow, createStep } = init(inngest);
```

## Test agent-loop scenarios

From the repository root, build the integration and its test dependencies, then install the local Inngest dev server:

```bash
pnpm turbo build --filter '@mastra/inngest...'
pnpm --dir workflows/inngest setup:inngest-cli
```

Run selected shared agent-loop scenarios through the real Inngest dev server:

```bash
AIMOCK_INNGEST_WORKERS=1 \
AIMOCK_SCENARIOS='{queued-tool-approval,resumed-tool-output}' \
pnpm --dir workflows/inngest test:aimock
```

`test:aimock` selects the `e2e:workflows/inngest:aimock` Vitest project. It starts its own local app and dev servers; no cloud credentials are needed. `AIMOCK_SCENARIOS` accepts scenario filename stems or a brace glob. Without it, the project runs all shared scenarios. `AIMOCK_INNGEST_WORKERS` defaults to four; use one for serial regression runs.

The approval and resume scenarios include expected-failure pins for duplicate approval output (#27925) and missing resumed tool-call history (#27926). Vitest fails if a pinned test unexpectedly passes, so an upstream fix requires updating the pin.

## Documentation

- [Deploy Mastra with Inngest](https://mastra.ai/integrations/deploy/inngest)
- [Reference: createInngestAgent()](https://mastra.ai/reference/agents/inngest-agent)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workflows/inngest/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
