---
'@mastra/server': minor
---

Added memory, observability, and agent builder tools to the built-in MCP server at `/api/mcp`. MCP clients such as Claude Code can now read and manage threads and Observational Memory, query traces, logs, metrics, scores, and feedback, and create stored agents they can call right away with `call_agent`.

**New toolsets** (on by default, each shown only when the server supports it):

- `memory`: threads, messages, memory search, and Observational Memory. `get_observations` takes `waitForPending: true` to wait for Observational Memory to finish processing the latest messages, for example right after `call_agent`. These tools use the same ownership checks as the HTTP memory routes. With `mapUserToResourceId`, each caller only sees their own resource.
- `observability` and `observability_analytics`: trace and span queries, logs, and `analyze_metrics` / `analyze_scores` / `analyze_feedback`. Tools match what the observability store supports, so stores without trace queries serve `list_traces` instead of `query_traces`. `get_trace` returns the light trace with every span id (`get_span` has a span's input, output, and attributes), and results stay small enough for MCP clients: lists return a note on how to page the rest, and a single item that is still too big has its long values cut.
- `stored_agents`: list allowed models and create, read, and update stored agents. New and updated agents are published by default. Unlike the HTTP route, `update_stored_agent` sets `autoPublish: true` unless you pass `false`, so edits made over MCP go live immediately. When the agent builder restricts models, the tools check the model the agent runs (`provider` and `name`, in each conditional variant, with other keys on `model` rejected), models named in `defaultOptions` such as `structuredOutput.model`, enabled fallback models (`modelList`), memory models, input and output processor models, and the default Observational Memory model. The HTTP routes don't apply this check. Anything that would run on a default the allowlist can't check, such as `observationalMemory: true` or a moderation processor without a model, is rejected until an allowed model is set.

**Upgrading:** if you don't set `server.mcp.toolsets`, these toolsets, including tools that write threads, messages, and stored agents, appear in your MCP server after upgrading. Callers still need the matching permissions. Set `toolsets` to keep the previous set (`['agents', 'workflows', 'tools']`), or set `readOnly: true` to drop write tools.

Every tool runs through its HTTP route with the same permission and ownership checks. Observability data isn't scoped per user, so anyone with `observability:read` can see all traces. Choose toolsets explicitly to leave it out:

```ts
new Mastra({
  server: { mcp: { toolsets: ['agents', 'workflows', 'tools', 'memory', 'stored_agents'] } },
});
```
