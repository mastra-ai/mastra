---
'@mastra/core': patch
---

Fixed durable agents continuing past a tool call that the client is meant to execute.

A tool declared without `execute` runs on the client, which answers it on a follow-up request, so the run must end at the call. Durable agents instead recorded an empty result for it and called the model again — the agent answered as though the tool had returned nothing, and the client never received the call.

```ts
const agent = new Agent({
  model,
  durable: true,
  // No `execute`: the client runs this tool and sends the result back.
  tools: { approveInvoice: createTool({ id: 'approveInvoice', inputSchema }) },
});

// The turn now ends at the call so the client can answer it.
const { output } = await agent.stream('Approve invoice 42');
```

See [#23295](https://github.com/mastra-ai/mastra/issues/23295).
