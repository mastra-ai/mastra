---
'mastra': minor
---

Added `mastra api span query` and `mastra api span aggregate` for querying and aggregating individual observability spans, including agent runs and tool calls nested inside other traces.

`span query` lists completed spans that match a `where` predicate over span fields. Pass `data.page.next` back as `page.after` to fetch the next page:

```bash
mastra api span query '{"timeRange":{"from":"2026-08-07T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"where":{"op":"and","args":[{"op":"eq","left":{"path":"spanType"},"right":{"literal":"tool_call"}},{"op":"eq","left":{"path":"status"},"right":{"literal":"error"}}]}}'
```

`span aggregate` groups spans by span fields and returns counts, durations, error rates, tokens, and cost per group:

```bash
mastra api span aggregate '{"timeRange":{"from":"2026-08-01T00:00:00.000Z","to":"2026-08-08T00:00:00.000Z"},"where":{"op":"eq","left":{"path":"spanType"},"right":{"literal":"tool_call"}},"groupBy":["entityName"],"measures":["count","errorRate","duration.p95"]}'
```

Run either command with `--help` for more examples or `--schema` to inspect the request schema. Servers whose observability store doesn't support a command return an HTTP error, which the CLI prints with the server's response body.
