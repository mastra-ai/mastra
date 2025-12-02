---
'@mastra/braintrust': patch
---

Fix Braintrust UI displaying raw JSON payloads in input/output columns for LLM spans.

For MODEL_GENERATION spans, the exporter now extracts:
- Messages array from `{ messages: [...] }` input structure
- Plain text from `{ text: '...' }` or `{ content: '...' }` output structure

