---
'mastra': patch
---

Make the agent builder reliably back-fill new agents without hitting OpenAI `server_error`. The builder stream's output token cap is raised from 1,000 to 5,000 so `set-agent-instructions` JSON args don't get truncated mid-emit, the instructions snapshot directive now tells the builder to call the setter exactly once with a final version under 3,000 characters, and a programmatic backstop in the instructions tool clamps oversized values and surfaces the clip back to the model. Also restores the pre-existing `renderQuoted` / `renderInstructions` helpers in the form snapshot, drops the `→` glyph from per-field directives, treats whitespace-only field values as empty, sanitizes interpolated values, and guards the starter submit until the builder settings finish loading so the resolved model policy is always applied.
