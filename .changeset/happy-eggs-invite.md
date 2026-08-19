---
'@mastra/core': minor
---

Client-executed tools (tools without a server-side `execute`) now fire their `onOutput` lifecycle hook when the browser returns the tool result on a follow-up request. Previously `onOutput` only fired after a server-side `execute`, so client tools never reported their output.

```ts
const agent = new Agent({
  // ...
  tools: {
    browserTool: createTool({
      id: 'browserTool',
      description: 'Runs in the browser',
      inputSchema: z.object({ query: z.string() }),
      // No execute — the client runs the tool. This hook now fires when
      // the client sends the result back.
      onOutput: async ({ toolCallId, output }) => {
        console.log('client tool resolved', toolCallId, output);
      },
    }),
  },
});
```

The hook fires for trailing tool results that match a raw tool call from the preceding assistant message, so the follow-up request must include both (as `@mastra/client-js` does automatically). This works with standard, legacy, and durable agents, including requests with a same-name serialized `clientTools` entry. The callback receives `{ toolCallId, toolName, output, abortSignal }`. Because the input is client-provided, treat the output as untrusted data. Delivery is at least once, and the hook does not fire when an input processor rejects the request. Keep hooks idempotent.
