---
'@mastra/core': minor
'@mastra/factory': minor
'@mastra/platform-workspace': minor
'@mastra/e2b': minor
'@mastra/docker': minor
---

Factory sandbox providers now accept `env` as a function of the session's sandbox context, so a credential can reach one factory's sessions only. The context carries the new `factoryId` and `factoryName` fields. Scope secrets by `factoryId`, because names can be edited and are not unique.

```ts
new PlatformFactorySandbox({
  env: ctx => (ctx.factoryId === PLATFORM_FACTORY_ID ? { PLATFORM_TOKEN } : {}),
});
```
