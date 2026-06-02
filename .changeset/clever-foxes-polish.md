---
'mastra': patch
---

Make the agent builder reliably back-fill new agents:

- Raise the builder stream output token cap so `set-agent-instructions` JSON args no longer get truncated mid-stream.
- Tell the builder to call `set-agent-instructions` exactly once with a final version under 3,000 characters.
- Clamp oversized instructions server-side and surface the clip back to the model.
- Restore form snapshot helpers and drop the `→` glyph from per-field directives.
- Treat whitespace-only field values as empty and sanitize interpolated snapshot values.
- Guard the starter submit until builder settings load so the configured default model is always applied.
