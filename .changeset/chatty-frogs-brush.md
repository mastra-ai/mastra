---
'@mastra/core': patch
---

Fixed providerMetadata (e.g. Gemini thoughtSignature) being lost on assistant file parts during multi-turn conversations. This resolves 'Image part is missing a thought_signature' errors when round-tripping model-generated images with Gemini 3.x models.
