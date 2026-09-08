---
'@mastra/voice-openai-realtime': patch
---

Fixed public realtime speech boundary events and complete input transcription usage delivery.

Listen for speech boundaries to stop application playback, and read the complete transcription payload including usage. In this example, `stopPlayback` is your application's audio cleanup function:

```ts
voice.on('input_audio_buffer.speech_started', () => stopPlayback());
voice.on('conversation.item.input_audio_transcription.completed', event => {
  console.log(event.transcript, event.usage);
});
```
