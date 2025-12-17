---
'@mastra/express': patch
'@mastra/hono': patch
'@mastra/deployer': patch
'@mastra/server': patch
---

### Breaking Changes

- Renamed `RuntimeContext` type to `ServerContext` to avoid confusion with the user-facing `RequestContext` (previously called `RuntimeContext`)
- Removed `playground` and `isDev` options from server adapter constructors - these only set context variables without any actual functionality

### Changes

**@mastra/server**
- Renamed `RuntimeContext` type to `ServerContext` in route handler types
- Renamed `createTestRuntimeContext` to `createTestServerContext` in test utilities
- Renamed `isPlayground` parameter to `isStudio` in `formatAgent` function

**@mastra/hono**
- Removed `playground` and `isDev` from `HonoVariables` type
- Removed setting of `playground` and `isDev` context variables in middleware

**@mastra/express**
- Removed `playground` and `isDev` from `Express.Locals` interface
- Removed setting of `playground` and `isDev` in response locals
