---
'@mastra/core': minor
'@mastra/observability': minor
---

Add opt-in observability spans for provider-executed (server-side) tools

Provider-executed tools — e.g. Anthropic native code execution or server-side web search —
run on the model provider, so the agent loop never enters Mastra's tool-execution path and
no span is created; the tool's input and output are otherwise invisible in traces (unlike
client-executed tools, which get a `CLIENT_TOOL_CALL` span).

Enable the new `traceServerTools` observability config option (off by default) to
reconstruct a `TOOL_CALL` span from the stream — input = tool args from the `tool-call`
chunk, output = result from the paired `tool-result` chunk. The span is anchored on the
agent-run span (as client-tool spans are) so it is durable regardless of
`includeInternalSpans`. It can also be enabled with the `MASTRA_TRACE_SERVER_TOOLS=true`
environment variable.

```ts
import { Observability, MastraStorageExporter } from '@mastra/observability';

new Observability({
  configs: {
    default: {
      serviceName: 'my-service',
      traceServerTools: true, // record provider-executed (server-side) tool calls
      exporters: [new MastraStorageExporter()],
    },
  },
});
```

Resolves #19180.
