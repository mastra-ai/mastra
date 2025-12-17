---
'@mastra/braintrust': patch
---

Fix Braintrust Thread view not displaying LLM messages correctly

Transforms LLM input/output format to match Braintrust's expected format for Thread view. Input is unwrapped from `{ messages: [...] }` to direct array format, and output is unwrapped from `{ content: '...' }` to direct string format.

