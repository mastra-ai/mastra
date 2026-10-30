---
'@mastra/code-sdk': minor
---

Added control over rich scorer-result storage. Hosts can retain the safe default or enable their configured storage for Studio score access.

```ts
createMastraCode({ disableScoreStorage: false });
```
