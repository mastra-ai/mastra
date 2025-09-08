---
'@mastra/core': patch
---

Fix InvalidDataContentError when using image messages with AI SDK

Resolves an issue where passing image content in messages would throw an InvalidDataContentError. The fix properly handles multi-part content arrays containing both text and image parts when converting between Mastra and AI SDK message formats.
