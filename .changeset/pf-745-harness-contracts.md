---
'@mastra/core': minor
---

Added type-safe Harness v1 work-unit types under `@mastra/core/harness/v1`.

Developers can now use shared types for tasks, runs, evidence, and pending interactions when building Harness integrations. This release adds types only; it does not change runtime behavior.

```ts
import type { HarnessEvidence, HarnessTask } from '@mastra/core/harness/v1';

function taskLabel(task: HarnessTask) {
  return `${task.origin}:${task.status}`;
}

function evidenceId(evidence: HarnessEvidence) {
  return evidence.evidenceKind === 'workspace-action' ? evidence.entry.id : undefined;
}
```
