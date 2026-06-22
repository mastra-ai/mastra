---
'@mastra/voice-google-gemini-live': patch
---

Fixed realtime audio streaming — the package was sending the deprecated `realtime_input.media_chunks` wire shape, which caused Google's Gemini Live v1alpha endpoint to immediately close the WebSocket (code 1007). Audio frames now use the current `realtime_input.audio` shape. Additionally, the WebSocket close handler now includes the close `code` and `reason` in the `session` event so consumers can see protocol-level errors through the public API.
