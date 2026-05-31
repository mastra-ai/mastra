---
'@mastra/voice-google-gemini-live': patch
---

**Fixed** Gemini Live sessions now connect successfully when using native-audio models. Previously the connection failed during session setup.

**Fixed** tools are now invoked correctly. Previously tool calls were silently ignored even when tools were registered during setup.

**Fixed** tool results of any shape (arrays, primitives, objects) are now accepted. Previously, non-object tool return values caused sessions to close unexpectedly.

**Fixed** the `speaker` option is now honored when passed at the `VoiceConfig` root alongside `realtimeConfig`, not only when passed in the flat config shape.

**Changed** default model from `gemini-2.0-flash-exp` (shut down 2025-12-09) to `gemini-3.1-flash-live-preview` (Google's current Live API quickstart model). If you weren't explicitly setting `model`, your sessions will start connecting again.

Fixes #17018.
