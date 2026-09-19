---
'@mastra/core': minor
---

Default agents now recover from transient provider failures, assistant-prefill rejections, and provider history incompatibilities without extra configuration. A processor you supply with the same id is used instead of the matching default, and your processors keep their positions ahead of the added defaults. Pass `errorProcessors: []` to run with no error processors at all.
