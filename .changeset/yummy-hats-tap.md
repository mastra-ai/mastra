---
'@mastra/core': patch
---

Multiple Processor improvements including:

- Workflows can now return tripwires, they bubble up from agents that return tripwires in a step
- You can write processors as workflows using the existing Workflow primitive, every processor flow is now a workflow.
- tripwires that you throw can now return additional information including ability to retry the step
- New processor method `processOutputStep` added which runs after every step.

**What's new:**

**1. Retry mechanism with LLM feedback** - Processors can now request retries with feedback that gets sent back to the LLM:

```typescript
processOutputStep: async ({ text, abort, retryCount }) => {
  if (isLowQuality(text)) {
    abort('Response quality too low', { retry: true, metadata: { score: 0.6 } });
  }
  return [];
};
```

Configure with `maxProcessorRetries` (default: 3). Rejected steps are preserved in `result.steps[n].tripwire`. Retries are only available in `processOutputStep` and `processInputStep`. It will replay the step with additional context added.

**2. Workflow orchestration for processors** - Processors can now be composed using workflow primitives:

```typescript
import { createStep, createWorkflow } from '@mastra/core/workflows';
import {
  ProcessorStepSchema,
} from '@mastra/core/processors';

const moderationWorkflow = createWorkflow({ id: 'moderation', inputSchema: ProcessorStepSchema, outputSchema: ProcessorStepSchema })
  .then(createStep(new lengthValidator({...})))
  .parallel([createStep(new piiDetector({...}), createStep(new toxicityChecker({...}))])
  .commit();

const agent = new Agent({ inputProcessors: [moderationWorkflow] });
```

Every processor array that gets passed to an agent gets added as a workflow
<img width="614" height="673" alt="image" src="https://github.com/user-attachments/assets/0d79f1fd-8fca-4d86-8b45-22fddea984a8" />

**3. Extended tripwire API** - `abort()` now accepts options for retry control and typed metadata:

```typescript
abort('reason', { retry: true, metadata: { score: 0.8, category: 'quality' } });
```

**4. New `processOutputStep` method** - Per-step output processing with access to step number, finish reason, tool calls, and retry count.

**5. Workflow tripwire status** - Workflows now have a `'tripwire'` status distinct from `'failed'`, properly bubbling up processor rejections.
