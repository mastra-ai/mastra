# @mastra/runloop

[Runloop](https://runloop.ai) Devbox integration for Mastra [`Workspace`](https://mastra.ai/docs/workspace/overview) sandboxes.

## Install

```bash
npm install @mastra/runloop
```

## Configure

Set `RUNLOOP_API_KEY` (or pass `apiKey` in options).

```typescript
import { Workspace } from '@mastra/core/workspace';
import { RunloopSandbox } from '@mastra/runloop';

const workspace = new Workspace({
  sandbox: new RunloopSandbox({
    timeout: 120_000,
    blueprintName: 'my-blueprint', // optional
  }),
});
```

## Features

- Command execution and background processes via the Runloop TypeScript SDK (`cmd.exec` / `execAsync`)
- Stdin for async executions via `execution_id` and the executions API (`sendStdIn`)
- Lifecycle: `_start` / `_stop` (suspend) / `_destroy` (shutdown), with resume for reconnection-style flows
- **Not supported:** Mastra workspace `mount()` / `unmount()` — use Runloop devbox creation options for code or data at boot

## Scripts

- `pnpm build` — bundle + `.d.ts`
- `pnpm test:unit` — unit tests
- `pnpm test` — integration tests (requires `RUNLOOP_API_KEY`)

## License

Apache-2.0
