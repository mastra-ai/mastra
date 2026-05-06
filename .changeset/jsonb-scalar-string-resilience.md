---
'@mastra/pg': patch
---

Fixed agent listing endpoints returning HTTP 500 when a single `mastra_agent_versions` row had a malformed `model` value, hiding every other agent in the Mastra Editor. A bad row is now skipped and a warning is logged so the rest of the listing keeps working.

`createVersion` now rejects a string `model` with a typed `INVALID_MODEL` error to stop the bad shape from being written. Pass an object instead, e.g. `{ slug: "anthropic/claude-haiku-4.5" }`.

Fixes #16224.
