---
'@mastra/core': minor
---

Added status-bearing judge execution details to scorer results.

```typescript
const result = await scorer.run(input);
const execution = result.judge?.generateScore?.executions[0];

if (execution?.status === 'success') {
  console.log(execution.output, execution.usage);
}
```

Prompt-based scorer steps now expose successful logical executions with `status: 'success'`, their prompt, structured output, judge model identity, normalized token usage, attempt and model-call counts, and duration. A structured-output fallback that eventually succeeds remains one execution with its attempts aggregated. Use this data to interpret one scorer run without reconstructing it from traces.
