---
'@mastra/core': patch
---

Fixed tool `transform` replacing stored tool-call arguments with a `Tool input-available payload unavailable` placeholder when only another phase (such as `transcript.output`) was configured. A tool-level transform now only changes the phases it defines, so stored `args` round-trip unchanged and replaying the thread with Anthropic preserved thinking no longer fails. Transformers that throw or return `undefined` still fall back to the placeholder, and raw input deltas stay suppressed. Fixes #26597.
