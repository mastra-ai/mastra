Build from root: pnpm --filter ./agent-sdks/acp build:lib
Test from root: pnpm --filter ./agent-sdks/acp test

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
