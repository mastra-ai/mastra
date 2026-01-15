---
'@mastra/braintrust': patch
---

Improves AI SDK message conversion for Braintrust Thread view:

- Adds support for non-text content types (images, files, reasoning) with informative placeholders
- Handles both AI SDK v4 `result` and v5 `output` fields for tool results
- Gracefully handles empty content arrays and unknown content types
- Adds comprehensive TypeScript type definitions for message conversion
