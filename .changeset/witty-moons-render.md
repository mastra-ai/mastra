---
'@mastra/react': minor
---

`WorkflowStepFactory` understands the new declarative step entries.

**New resolved kinds.** `agent-step` and `tool-step` with matching `AgentStep` / `ToolStep` renderer slots. Entries without a dedicated renderer still fall back to `UnknownStep`.

**`map-step` resolves from the dedicated `type: 'mapping'` entry.** Previously a generic `type: 'step'` entry carrying `mapConfig`. `ResolvedWorkflowMapStep['flow']` is a union of both shapes — narrow on `flow.type` before reading the mapping code (`flow.mapConfig` for `'mapping'` entries, `flow.step.mapConfig` for legacy `'step'` entries).

**`nested-workflow-step` also resolves from the first-class `type: 'workflow'` entry** emitted for `.then(subWorkflow)`, which carries `workflowId` and the nested `serializedStepFlow`.

**Usage.** Pass a `ResolvedWorkflowStep` and the renderer slots you care about; unhandled kinds fall through to `UnknownStep`:

```tsx
import { WorkflowStepFactory } from '@mastra/react';
import type { ResolvedWorkflowStep } from '@mastra/react';

function StepNode({ step }: { step: ResolvedWorkflowStep }) {
  return (
    <WorkflowStepFactory
      step={step}
      AgentStep={s => <AgentCard agentId={s.flow.agentId} result={s.result} />}
      ToolStep={s => <ToolCard toolId={s.flow.toolId} result={s.result} />}
      MapStep={s => (
        <MapCard code={s.flow.type === 'mapping' ? s.flow.mapConfig : s.flow.step.mapConfig} />
      )}
      UnknownStep={s => <GenericCard id={s.id} />}
    />
  );
}
```
