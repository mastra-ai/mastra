---
'@mastra/core': patch
---

Fixed `TokenLimiterProcessor` dropping the current run's tool calls and results between agent steps. Before, the model never saw the tool data and called the same tool again until `maxSteps` ran out. Now the limiter only trims older history. If the current run alone doesn't fit, it throws a `TripWire` instead of silently dropping data.

Added an optional `maxToolResultTokens` setting that sends the model a truncated copy of oversized tool results. The stored result is kept intact.

```typescript
const processor = new TokenLimiterProcessor({ limit: 8000, maxToolResultTokens: 2000 });
```
