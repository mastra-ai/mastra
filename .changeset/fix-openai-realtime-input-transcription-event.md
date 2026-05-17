---
'@mastra/voice-openai-realtime': patch
---

Fix `OpenAIRealtimeVoice` listening for nonexistent `conversation.item.input_audio_transcription.done` event. OpenAI's Realtime API emits `.completed` for input transcription finalization (the underlying `openai-realtime-api` SDK only emits `.completed`/`.failed`, never `.done`). As a result, the user-side `writing` event with `text: "\n"` was never emitted; any consumer accumulating `.delta` text and flushing on the final `"\n"` marker would never finalize individual user utterances mid-session, ending up with all utterances merged into a single message persisted only at session close.
