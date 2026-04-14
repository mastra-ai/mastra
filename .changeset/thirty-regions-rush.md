---
'mastra': minor
---

Added `mastra run` command for headless one-shot agent invocation.

```bash
mastra run -a myAgent -p "List 3 colors" --output-format json \
  --json-schema '{"type":"object","properties":{"colors":{"type":"array","items":{"type":"string"}}}}'
```

**Flags**

- `-a, --agent <agent-id>` — required, the agent to run
- `-p, --prompt <prompt>` — prompt text; can also be piped via stdin
- `-f, --output-format <format>` — one of `text` (default, streamed deltas), `json` (single result envelope), or `stream-json` (NDJSON of raw chunks)
- `--json-schema <schema>` — JSON Schema for structured output (requires `json` or `stream-json`)
- `--strict` — treat warnings as errors (exit code 1)
- `-d, --dir`, `-r, --root`, `-e, --env`, `--debug` — path and diagnostic overrides
