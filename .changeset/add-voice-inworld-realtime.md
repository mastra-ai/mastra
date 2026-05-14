---
'@mastra/voice-inworld-realtime': minor
---

Add Inworld Realtime API as a full-duplex voice provider. Sibling to `@mastra/voice-openai-realtime`. Inworld's wire protocol is the OpenAI Realtime GA spec — same client and server event names on both sides. Provider-level differences: endpoint (`wss://api.inworld.ai/api/v1/realtime/session`), `Authorization: Basic <key>` with verbatim (pre-encoded) API keys, default model `anthropic/claude-sonnet-4-6`, and Inworld-specific knobs (MCP tool routing, semantic VAD eagerness, playback speed, voice catalog) surfaced through a `providerData` escape hatch shallow-merged into every `session.update`.
