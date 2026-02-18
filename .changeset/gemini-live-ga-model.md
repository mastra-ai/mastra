---
"@mastra/voice-google-gemini-live": patch
---

Add new models to GeminiVoiceModel type and mark deprecated models with `@deprecated` JSDoc.

**Added:**
- `gemini-live-2.5-flash-native-audio` (GA)
- `gemini-live-2.5-flash-preview-native-audio-09-2025`
- `gemini-2.5-flash-native-audio-preview-12-2025`
- `gemini-2.5-flash-native-audio-preview-09-2025`

**Deprecated:**
- `gemini-2.0-flash-exp` (shut down 2025-12-09)
- `gemini-2.0-flash-exp-image-generation` (shut down 2025-11-14)
- `gemini-2.0-flash-live-001` (shut down 2025-12-09)
- `gemini-live-2.5-flash-preview-native-audio` (use `gemini-live-2.5-flash-preview-native-audio-09-2025`)
- `gemini-2.5-flash-exp-native-audio-thinking-dialog` (shut down 2025-10-20)
- `gemini-live-2.5-flash-preview` (shut down 2025-12-09)
