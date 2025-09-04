---
'@mastra/core': patch
---

Fix image input handling for Google Gemini models in AI SDK V5

Resolves issue #7362 where Gemini threw `AI_InvalidDataContentError` when receiving URLs in image parts. The fix properly handles V3 message file parts that contain both URL and data fields, ensuring URLs are passed as URLs rather than being incorrectly treated as base64 data.
