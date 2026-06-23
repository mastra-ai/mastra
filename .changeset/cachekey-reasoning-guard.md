---
'@mastra/core': patch
---

Guard `CacheKeyGenerator.fromAIV4Part` against reasoning parts with empty/undefined `details` text. Models that emit an empty reasoning summary (Anthropic Opus 4.7/4.8 with thinking `display: omitted`, OpenAI gpt-5.x via the Responses API with no summary) persist a reasoning part shaped `{ type: 'reasoning', reasoning: '', details: [{ type: 'text' }] }` — the text detail has no `text` field. On the next turn, Observational Memory reloads that message and the cache-key generator crashed with `TypeError: Cannot read properties of undefined (reading 'length')`, killing the whole turn (`PROCESSOR_WORKFLOW_FAILED`). This is the reasoning-branch sibling of the tool-invocation guard (#16756 / #16773). The reduce now tolerates missing `details` and missing detail `text`; no behavior change for well-formed parts. Fixes #18280.
