Build from root: pnpm --filter ./packages/acp build:lib
Test from root: pnpm --filter ./packages/acp test

Source mode / no-build local validation
Use `MASTRA_SOURCE_MODE=true` when running package tests or linked local projects that should resolve Mastra workspace packages from source instead of requiring expensive repo builds. Prefix the normal focused command, for example `MASTRA_SOURCE_MODE=true pnpm test:cli`, `MASTRA_SOURCE_MODE=true pnpm --filter ./packages/name test`, or `MASTRA_SOURCE_MODE=true mastra dev` from a linked local project. `mastra dev` only honors this env var when the CLI is linked to a local Mastra repo checkout; normal published installs keep stable behavior.

This package exposes `createACPTool`, a helper that wraps a single ACP-compatible coding agent process as a Mastra tool.

```ts
import { createACPTool } from '@mastra/acp';

const claudeTool = createACPTool({
  id: 'claude-code',
  description: 'Build anything with Claude Code',
  command: 'claude',
  args: ['--acp'],
});
```

Implementation notes:

- `ACPConnection` owns process lifecycle, lazy ACP initialization, prompt execution, cancellation, and cleanup.
- `createACPTool` should stay small and only adapt Mastra tool input/output to `ACPConnection.prompt()`.
- Keep tests colocated under `src/**/__tests__` or `src/**/*.test.ts`.
