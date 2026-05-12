---
'@mastra/voice-inworld-realtime': minor
---

Add Inworld Realtime API as a full-duplex voice provider. Sibling to `@mastra/voice-openai-realtime`. Inworld's protocol is the OpenAI Realtime GA spec with two deltas: `conversation.item.added` (rename of `conversation.item.created`) and `conversation.item.done` (Inworld extension). Uses `Authorization: Basic <key>` with verbatim API keys (Inworld keys ship pre-encoded). Defaults to `anthropic/claude-sonnet-4-6` and the `Dennis` voice; Inworld-specific knobs (MCP tool routing, semantic VAD eagerness, playback speed) flow through a `providerData` escape hatch.
