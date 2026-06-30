---
'@mastra/memory': minor
'@mastra/core': patch
---

add observational memory extractors

Introduces a public Extractor API for Observational Memory
with inline XML extraction and structured follow-up modes.
Includes built-in extractors for current task, suggested
response, and thread title. Persists extracted values into
thread OM metadata with key-level merging and carry-forward
into future observer/reflector prompts.
