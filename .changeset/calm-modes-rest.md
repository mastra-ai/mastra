---
'@mastra/code-sdk': minor
---

`createMastraCodeAgentController` now accepts `modes: false` for hosts that don't offer modes. Every session runs as the single Build agent: a thread last used in another mode reopens in Build, and per-mode thinking defaults from settings never apply. Runs without a session override use the global thinking level.

```typescript
const controller = await createMastraCodeAgentController({ modes: false });
```
