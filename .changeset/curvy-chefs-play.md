---
'@mastra/server': patch
---

Accept both MCP server families from the core registry. Legacy SSE routes stay available for MCP 1.x servers and return 404 for 2.x servers, and the REST tool execute route reports a tool that suspended for input as `{ status: 'suspended', suspendPayload, resumeSchema }` instead of pretending it completed.

```ts
const res = await fetch(`/api/mcp/${serverId}/tools/${toolId}/execute`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ data: { orderId: 'ord_1' } }),
});
const body = await res.json();

if ('status' in body && body.status === 'suspended') {
  // The tool paused; body.resumeSchema (JSON Schema) describes the answer it needs.
  console.log('tool asked for input', body.suspendPayload, body.resumeSchema);
} else {
  console.log('tool result', body.result);
}
```
