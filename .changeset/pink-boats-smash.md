---
'@mastra/memory': patch
---

Fixed Observational Memory date hints changing the observation prompt prefix at midnight. Absolute observations and static date gaps remain in their original chunks; bounded live relative-date cues now follow the observation block and use its recorded time zone. The complete suffix, including tags, explanation and omission notice, stays within 8,000 characters and 64 date cues. This protects the observation prefix only, not later messages or provider cache-hit rates.

Set `liveDateHints: false` to omit live date cues while preserving absolute observations and static date gaps. Live hints remain enabled by default.

```typescript
new Memory({
  options: { observationalMemory: { liveDateHints: false } },
});
```
