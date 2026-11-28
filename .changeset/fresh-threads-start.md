---
'@mastra/core': minor
'@mastra/code-sdk': minor
---

`AgentController.createSession()` and `createMastraCode()` take a new `resumeLatestThread` option. Set it to `false` to start a session without binding the most recent thread in its scope:

```ts
const session = await controller.createSession({ createInitialThread: false, resumeLatestThread: false });
```
