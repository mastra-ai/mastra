---
'@mastra/react': minor
'@mastra/server': patch
---

Added voice helpers to the React SDK and made agent text-to-speech audible.

The React SDK now exposes voice helpers: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for streaming text-to-speech playback, and `recordMicrophoneToFile` for capturing microphone audio. The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

```tsx
import { useSpeechRecognition } from '@mastra/react';

function VoiceInput({ agentId }: { agentId?: string }) {
  const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
  return <button onClick={isListening ? stop : start}>{transcript}</button>;
}
```

Also fixed agent text-to-speech being inaudible. The `voice/speak` route now returns a web-standard audio response (`Content-Type: audio/mpeg`) so server-side adapters stream the raw audio bytes through to the client instead of JSON-encoding them. This also resolves `getReader` crashes when an agent speaks using providers like OpenAI voice.
