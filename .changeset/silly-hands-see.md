---
'@mastra/evals': patch
---

Reduced memory used by `@mastra/evals` on Cloudflare Workers. Its published JavaScript now contains only ASCII characters, so the Worker runtime can store the bundled source at one byte per character instead of two. Rubric checklists still accept `•`, `-`, `*`, `1.` and `1)` list markers as before.
