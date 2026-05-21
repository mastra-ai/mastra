---
'@mastra/core': patch
---

fix(core): recover streamed tool-call args via sanitize + repair instead of silently dropping to `{}`

`MastraModelOutput`'s `tool-call-input-streaming-end` handler joined accumulated `tool-call-delta` text and called `JSON.parse` directly. On failure it fell through to `args: {}` — the synthetic `tool-call` chunk then carried empty args even when the original deltas were recoverable.

This is the same shape as the bug fixed on the consolidated `tool-call` path in #13400 (`sanitizeToolCallInput` for `<|...|>` token tails) and the `tryRepairJson` recovery path used in the same `aisdk/v5/transform.ts` site. The streaming-end synth path now mirrors that flow:

1. Sanitize the joined delta string (strips LLM token tails like `<|call|>`).
2. `JSON.parse` the sanitized string.
3. On parse failure, attempt JSON repair (`tryRepairJson`) and use the repaired value if successful.
4. Only fall through to `args: {}` (with a `console.error`) when none of the above recovers a value.

Affected providers include OpenAI-compatible passthroughs (Vercel AI Gateway → DeepSeek, OpenRouter, Novita) that emit tool args as multiple delta chunks plus an LLM token tail. Without this fix, downstream `execute()` callbacks received empty args, schema validation rejected them, and the agent loop either fell into a recovery path or escalated the run.
