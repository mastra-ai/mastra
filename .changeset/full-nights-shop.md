---
'@mastra/react': minor
---

Added voice helpers to the React SDK: `useSpeechRecognition` for speech-to-text, `playStreamWithWebAudio` for streaming text-to-speech playback, and `recordMicrophoneToFile` for capturing microphone audio.

The `useSpeechRecognition` hook automatically uses an agent's voice provider when one is configured, and falls back to the browser's built-in speech recognition otherwise.

```tsx
import { useSpeechRecognition } from '@mastra/react';

function VoiceInput({ agentId }: { agentId?: string }) {
  const { start, stop, isListening, transcript } = useSpeechRecognition({ agentId });
  return <button onClick={isListening ? stop : start}>{transcript}</button>;
}
```
