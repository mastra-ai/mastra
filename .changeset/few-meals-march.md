---
'@mastra/core': patch
---

Fixed unbounded memory growth during long goal runs. A goal run chains many agent turns inside one stream, and the stream previously kept every chunk, step, tool result, and text delta of the entire run in memory (and in suspend snapshots). Goal evaluations now carry the goal gate's explicit `shouldContinue` decision, and the stream clears its run-lifetime buffers at each continuing evaluation — the judged turn's messages are already persisted by then. Terminal evaluations (completion, waiting for user, judge failure, budget exhaustion) do not truncate, so the final turn is preserved.

**Behavior change for goal runs:** run-end results now cover the final iteration of the run (everything after the last continuing evaluation) instead of every turn. Streamed chunks, token usage totals, and persisted messages are unaffected — only the aggregates resolved at the end of the run change. Agents without a `goal` config are unaffected.

```ts
const agent = new Agent({
  name: 'coder',
  model: 'openai/gpt-5.5',
  goal: { judge: 'openai/gpt-5-mini' },
});

const stream = await agent.stream('Implement feature X');
const output = await stream.getFullOutput();

// Before: output.text, output.steps, output.toolCalls, and output.toolResults
// aggregated every turn of the goal run (e.g. 50 turns concatenated).

// After: they cover the final iteration — the turn(s) judged by the terminal
// evaluation, i.e. the goal's final answer. Use output.messages (or memory)
// for the full conversation; output.totalUsage still spans the entire run.
```
