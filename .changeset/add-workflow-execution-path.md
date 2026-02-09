---
'@mastra/core': minor
---

Add workflow execution path tracking and optimize execution logs

Workflow results now include a `stepExecutionPath` array showing the IDs of each step that executed during a workflow run. You can use this to understand exactly which path your workflow took.

```ts
// Before: no execution path in results
const result = await workflow.execute({ triggerData });
// result.stepExecutionPath → undefined

// After: stepExecutionPath is available in workflow results
const result = await workflow.execute({ triggerData });
console.log(result.stepExecutionPath);
// → ['step1', 'step2', 'step4'] — the actual steps that ran
```

`stepExecutionPath` is available in:

- **Workflow results** (`WorkflowResult.stepExecutionPath`) — see which steps ran after execution completes
- **Execution context** (`ExecutionContext.stepExecutionPath`) — access the path mid-execution inside your steps
- **Resume and restart operations** — execution path persists across suspend/resume and restart cycles

Workflow execution logs are now more compact and easier to read. Step outputs are no longer duplicated as the next step's input, reducing the size of execution results while maintaining full visibility.

**Key improvements:**
- Track which steps executed in your workflows with `stepExecutionPath`
- Smaller, more readable execution logs with automatic duplicate payload removal
- Execution path preserved when resuming or restarting workflows

This is particularly beneficial for AI agents and LLM-based workflows where reducing context size improves performance and cost efficiency.

Related: `#8951`
