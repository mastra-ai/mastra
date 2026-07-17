---
'@mastra/core': patch
---

Fixed unbounded memory growth during long goal runs. A goal run chains many agent turns inside one stream, and the stream previously kept every chunk, step, tool result, and text delta of the entire run in memory (and in suspend snapshots). Now each completed goal judge evaluation clears these run-lifetime buffers, preventing out-of-memory crashes on long goal runs.

**Behavior change for goal runs:** run-end results now cover the segment after the last judge evaluation instead of every turn of the run. Streamed chunks, token usage totals, and persisted messages are unaffected — only the aggregates resolved at the end of the run change. Agents without a `goal` config are unaffected.

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

// After: they cover only the turns after the last judge evaluation — for a
// completed goal, the final answer. Use output.messages (or memory) for the
// full conversation; output.totalUsage still spans the entire run.
```
