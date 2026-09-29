---
'@mastra/observability': patch
---

Fixed `model_step` spans exporting the provider's raw HTTP response body in their metadata. For some providers (for example, Azure OpenAI's Responses API) this added hundreds of kilobytes to each step span while repeating output and usage already on the span. Response headers are still exported, so provider request IDs and rate-limit details remain available for debugging. Fixes #24826.
