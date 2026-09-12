---
'@mastra/code-sdk': patch
---

Removed the duplicate task list from `MastraCodeState`. Read the session display snapshot for current tasks; task tools remain responsible for updates.

Before:

```ts
const tasks = session.state.get().tasks;
```

After:

```ts
const tasks = session.displayState.get().tasks;
```
