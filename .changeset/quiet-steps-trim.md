---
'@mastra/observability': patch
---

Fixed `model_step` spans exporting the provider's raw HTTP response body and headers in their metadata. For some providers (for example, Azure OpenAI's Responses API) this added hundreds of kilobytes to each step span and exposed provider request IDs and deployment details. Both fields are now removed, the same way the raw `request` already is.
