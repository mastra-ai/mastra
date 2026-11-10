---
'@mastra/react': minor
---

Added an optional callback to `start()` in `useSpeechRecognition` that receives the transcript as it is recognized.

```tsx
const { start, stop, isListening } = useSpeechRecognition({ agentId });

<button onClick={() => start(text => setDraft(text))}>Dictate</button>;
```

The callback belongs to the dictation session that `start()` begins. With browser speech recognition it is called after each finished phrase with the full transcript of the session so far. With an agent voice provider it is called once the recording is transcribed. A session replaced by a newer `start()` never calls its callback.

You no longer need an effect watching `transcript` to copy dictated text into an input. `transcript` is still returned.
