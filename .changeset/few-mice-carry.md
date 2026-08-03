---
'@mastra/code-sdk': patch
---

Added `autonomousSession` to session state for unattended runs. When set, the session skips global (home directory) agent instruction files and reads only project-scoped ones, so its output does not depend on the machine hosting it. Interactive sessions are unaffected.

```ts
await session.state.set({ autonomousSession: true });
```
