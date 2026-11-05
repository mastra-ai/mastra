---
'@mastra/code-sdk': patch
---

Added the `planApprovalStartsGoal` option to `createMastraCode()`. It defaults to `true`, and the plan-mode prompt tells the agent that approving a plan starts a goal. Set it to `false` for hosts where approval only switches to Build mode, so the agent isn't told a goal will start:

```ts
const { controller, session } = await createMastraCode({ planApprovalStartsGoal: false });
```

ACP sessions and the headless CLI set it to `false`.
