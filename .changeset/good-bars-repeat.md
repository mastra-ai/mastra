---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Preserved unknown AgentController token usage instead of reporting missing provider counts as zero.

The primary `TokenUsage` fields are now optional across Core, the server response schema, and the generated JavaScript client contract. Aggregates remain unknown when any contributing step omits that count, while an explicitly measured zero remains `0`.

**Before**

```ts
formatTokens(usage.totalTokens);
```

**After**

```ts
const total = usage.totalTokens === undefined ? 'unknown' : formatTokens(usage.totalTokens);
```
