---
'@mastra/voice-google-gemini-live': patch
---

Fix missing usage events when Gemini Live sends usage metadata alongside response content, setup, or tool calls. Preserve content-derived modality and normal message routing while processing usage independently.
