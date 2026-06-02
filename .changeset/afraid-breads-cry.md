---
'@mastra/voice-google-gemini-live': minor
---

Surface native-audio behavioral signals on Gemini Live realtime sessions (#17021).

The `@mastra/voice-google-gemini-live` provider now enables transcription and barge-in detection in the setup payload and exposes them through Mastra's standard realtime event contract. This makes native-audio models such as `gemini-2.5-flash-native-audio-preview-12-2025` and `gemini-3.1-flash-live-preview` behaviorally usable end-to-end. Until now, the spoken response was silently dropped on native-audio because it arrives on a different wire channel from the model's internal reasoning.

**What changed**

- Setup payload unconditionally includes `input_audio_transcription`, `output_audio_transcription`, and `realtime_input_config.activity_handling = 'START_OF_ACTIVITY_INTERRUPTS'`, matching how the OpenAI, xAI, Inworld, and AWS Nova Sonic providers enable transcription by default.
- User-side transcripts emit as `writing` with `role: 'user'`. Model-side transcripts emit as `writing` with `role: 'assistant'`. This matches the cross-provider `writing` contract.
- Barge-in (the server cancelling its in-flight response when the user starts speaking) emits an `interrupt` event with `{ type: 'user', timestamp }`, matching `@mastra/voice-aws-nova-sonic`.
- On native-audio models, `modelTurn.parts.text` is the model's internal chain-of-thought, not the spoken response. It now emits as a Gemini-specific `thinking` event so consumers can render reasoning separately. On non-native-audio models, `modelTurn.parts.text` continues to emit as `writing` (it is the spoken response there).

**Example**

```ts
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

const voice = new GeminiLiveVoice({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'gemini-2.5-flash-native-audio-preview-12-2025',
});

voice.on('writing', ({ text, role }) => {
  // role: 'user'      → speech-to-text of the caller
  // role: 'assistant' → speech-to-text of the model's spoken reply
});

voice.on('thinking', ({ text }) => {
  // Gemini's internal reasoning on native-audio models
});

voice.on('interrupt', ({ type, timestamp }) => {
  // Drop queued TTS audio — the user just barged in
});

await voice.connect();
```
