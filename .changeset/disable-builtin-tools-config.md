---
'@mastra/code-sdk': minor
'@mastra/factory': minor
---

You can now remove agent controller built-in tools such as `submit_plan` without reaching into the controller's private config. Set `disableBuiltinTools` on `createMastraCode()` / `prepareAgentControllerMount()`, or on `MastraFactory` to apply it to every Factory session. When `submit_plan` is unavailable, plan mode tells the model to write the plan file instead of calling it.

```ts
new MastraFactory({ storage, disableBuiltinTools: ['submit_plan'] });
```
