---
'@mastra/code-sdk': minor
'@mastra/factory': patch
---

Added a `plansDir` option to `createMastraCode` and `prepareAgentControllerMount` that sets where agents write plan files. When set, the prompts, the plan-mode write guard, and build-mode `submit_plan` guidance all use it instead of the per-session default.

```ts
const code = await createMastraCode({ plansDir: '.artifacts/plans' });
```

Factory now sets `plansDir: '.artifacts/plans'` for every session. Plans written from Factory user sessions previously landed in `.mastracode/plans/`, which the Factory UI can't read, so the plan card showed "The plan could not be loaded" and Approve was disabled.
