---
'@mastra/braintrust': minor
---

Format agent input/output for better Braintrust UI display

Formats agent run and workflow run spans to display human-readable text in Braintrust UI instead of raw JSON. Message arrays are converted to readable text format, and structured output objects extract the text field for cleaner display. LLM generation spans preserve raw data for debugging purposes.

