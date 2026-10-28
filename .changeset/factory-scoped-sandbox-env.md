---
'@mastra/core': minor
'@mastra/factory': minor
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
'@mastra/docker': minor
---

Added factory-scoped sandbox environment. A deployment that hosts several factories can now give a credential to one factory's sessions only: every Factory sandbox provider accepts `env` as a function of the session's sandbox context, which carries the new `factoryId` and `factoryName` fields. Scope secrets by `factoryId`, because names can be edited and aren't unique.

```ts
new PlatformFactorySandbox({
  env: ctx => (ctx.factoryId === PLATFORM_FACTORY_ID ? { PLATFORM_TOKEN } : {}),
});
```

Platform and Docker sandboxes keep the environment they started with when they resume. When you remove a credential from a factory, recreate its running sandboxes.
