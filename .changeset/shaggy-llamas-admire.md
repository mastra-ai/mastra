---
'@mastra/core': patch
---

Fixed a false-positive conflict where a tool loaded through tool search was treated as a foreign always-available tool after approval resume, durable replay, or tool-surface-fence restore, failing the resumed run with 'conflicts with an always-available input tool'. Loaded tools now carry a provenance marker that survives makeCoreTool conversion, so the collision guard only rejects genuinely different executors sharing a loaded tool's name.
