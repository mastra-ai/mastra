---
'@mastra/server': patch
---

Fixed agent generate and stream requests being rejected with a 400 error when `memory.resource` was omitted but server auth was configured with `mapUserToResourceId`. The request body schema required `memory.resource` even though the server derives the resource ID from the authenticated user and overrides any client-provided value.

Clients no longer need to send a placeholder resource ID:

```json
{
  "messages": ["what was my last message?"],
  "memory": { "thread": "test-thread" }
}
```

If a request uses memory and neither the body nor the authenticated request context provides a resource ID, the server now returns a clear 400 error. Fixes [#19518](https://github.com/mastra-ai/mastra/issues/19518).
