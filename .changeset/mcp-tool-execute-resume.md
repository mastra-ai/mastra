---
'@mastra/client-js': patch
---

`MCPTool.execute()` is typed as the REST route's response (`{ result }` or `{ status: 'suspended', suspendPayload, resumeSchema }`) and accepts `resumeData` and `suspendPayload` so a suspended tool on a 2026-07-28 MCP server can be continued.

```ts
const tool = client.getMcpServerTool('returns', 'createReturn');
const first = await tool.execute({ data: { orderId: 'ord_1' } });
if ('status' in first && first.status === 'suspended') {
  const done = await tool.execute({
    data: { orderId: 'ord_1' },
    resumeData: { confirmed: true },
    suspendPayload: first.suspendPayload,
  });
}
```
