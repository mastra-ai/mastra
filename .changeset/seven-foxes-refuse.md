---
'@mastra/server': minor
---

Added A2A Protocol v1.0 request handling through the standard A2A routes. Send `A2A-Version: 1.0` to use v1 methods, streaming responses, and task listing while existing requests continue to use v0.3.

```typescript
await fetch('/api/a2a/weather-agent', {
  method: 'POST',
  headers: { 'A2A-Version': '1.0' },
  body: JSON.stringify({ jsonrpc: '2.0', id: '1', method: 'tasks/list', params: {} }),
});
```
