---
"@mastra/voice-google-gemini-live": patch
---

Fix sendContext() being rejected (WS 1007) on gemini-3.1-flash-live-preview by emitting `history_config: { initial_history_in_client_content: true }` in the setup frame. Also exposes `initialHistoryInClientContent` on `GeminiSessionConfig` so callers can opt out explicitly.
