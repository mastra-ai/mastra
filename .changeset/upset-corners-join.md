---
'@mastra/core': patch
---

Added workspace policy evaluation for desktop hosts and other constrained runtimes.

**What changed**
- Added pre-run checks for file, command, network, and Model Context Protocol (MCP) access.
- Added consistent decision order: `deny` before `ask`, and `ask` before `allow`.
- Added resolved paths and matched rules in results for approval screens and audit logs.

```ts
import { evaluateWorkspacePolicy } from '@mastra/core/harness/v1';

const result = evaluateWorkspacePolicy(
  {
    roots: [{ id: 'project', path: '/workspace/project', writable: true }],
    defaultDecision: 'deny',
    rules: [{ kind: 'file', rootId: 'project', operation: 'write', decision: 'ask' }],
  },
  { kind: 'file', operation: 'write', path: 'src/index.ts', rootId: 'project' },
);

if (result.decision !== 'allow') {
  throw new Error(
    result.decision === 'ask' ? `Approval required: ${result.reasons.join(', ')}` : result.reasons.join(', '),
  );
}
```
