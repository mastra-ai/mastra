---
'@mastra/factory': minor
---

Added opt-in rich score persistence for Factory deployments so trace scores can appear in Mastra Studio. Storage remains disabled by default to avoid unbounded score growth.

```ts
new MastraFactory({ storage, disableScoreStorage: false });
```
