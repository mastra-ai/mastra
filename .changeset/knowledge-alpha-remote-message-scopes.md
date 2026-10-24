---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Remote callers can send per-message scopes: `session(id).sendMessage({ content, scopes })` in `@mastra/client-js` posts them to the agent controller `messages` route. Scope tags are authority, so the server accepts only tag types listed in the controller's new `allowedMessageScopeTypes` option and answers 403 for any other tag. The list is empty by default, so remote messages carry no scopes unless the host opts in:

```ts
new AgentController({ id: 'code', modes, allowedMessageScopeTypes: ['request'] });
```
