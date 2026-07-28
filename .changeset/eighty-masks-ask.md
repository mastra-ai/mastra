---
'@mastra/core': minor
---

Added structured judge execution details to scorer results.

```typescript
const result = await scorer.run(input);
const usage = result.judge?.generateScore?.executions[0]?.usage;
```

Prompt-based scorer steps now expose their prompt, structured output, judge model identity, normalized token usage, attempt and model-call counts, and duration. Use this data to interpret one scorer run without reconstructing it from traces.
