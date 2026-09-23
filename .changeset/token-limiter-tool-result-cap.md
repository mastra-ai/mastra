---
'@mastra/core': patch
---

Added an opt-in way to stop agents looping without ever seeing their tool results. Under `TokenLimiterProcessor`, a large tool result could exceed the conversation budget, so the step-level trim evicted the tool call/result pair the model was waiting on, and the model called the same tool again on the next step. Setting the new `maxToolResultTokens` option below is what prevents this; existing configurations that leave it unset keep their current behavior.

Processors registered as `inputProcessors` now also run their `processToolResult` hook, which previously fired only for `outputProcessors`. A processor registered on both phases still runs exactly once per tool result.

`TokenLimiterProcessor` accepts a new `maxToolResultTokens` option that caps a single tool result. It is unset by default, so tool results pass through untouched. When set, an oversized result is truncated in place with a visible `[truncated: showing X of Y tokens]` marker before it reaches history or the next LLM call. The marker's own cost is counted against the cap, so the capped result stays within `maxToolResultTokens`; the reported count is therefore the retained content, excluding the marker.

Tool results carrying MCP media (`{ content: [{ type: 'image' | 'audio', data }] }`) keep their structure so they still reach the model as native image/audio rather than a truncated JSON string. The media itself is never cut — truncating base64 corrupts it rather than shrinking it — but the result as a whole is still capped: media is charged a flat size estimate and any text alongside it is truncated to fit the remaining budget.

```ts
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';

const agent = new Agent({
  name: 'research-agent',
  instructions: 'Answer questions using the search tool.',
  model: 'openai/gpt-4o-mini',
  tools: { search },
  inputProcessors: [
    new TokenLimiterProcessor({
      limit: 100_000,
      // Cap any single tool result so one large payload cannot evict the
      // conversation the model needs to answer.
      maxToolResultTokens: 4_000,
    }),
  ],
});
```
