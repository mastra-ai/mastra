---
'@mastra/voice-openai-realtime': patch
---

Fixed public realtime speech boundary events and complete input transcription payload delivery. Subscribe to the native event names to receive speech timestamps and transcription usage when provided, without changing existing `writing` events.

```typescript
voice.on('input_audio_buffer.speech_started', event => {
  console.log(event.item_id, event.audio_start_ms);
});
voice.on('input_audio_buffer.speech_stopped', event => {
  console.log(event.item_id, event.audio_end_ms);
});
voice.on('conversation.item.input_audio_transcription.completed', event => {
  console.log(event.transcript, event.usage);
});
```
