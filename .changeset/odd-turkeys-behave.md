---
'@mastra/code-sdk': minor
---

Added `resolveDefaultThinkingLevel` so a host can supply the thinking level for requests whose session has not picked one. When set, it replaces the settings.json defaults; a session's own level still wins. It runs on every model resolution, including account-rotation hops, so a changed default applies to the next request.

```ts
const { controller } = await createMastraCodeAgentController({
  resolveDefaultThinkingLevel: async ({ requestContext }) => lookUpTeamThinkingLevel(requestContext),
});
```
