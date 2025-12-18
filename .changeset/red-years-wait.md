---
"@mastra/core": patch
---

Support AI SDK voice models

Mastra now supports AI SDK's transcription and speech models directly in `CompositeVoice`, enabling seamless integration with a wide range of voice providers through the AI SDK ecosystem. This allows you to use models from OpenAI, ElevenLabs, Groq, Deepgram, LMNT, Hume, and many more for both speech-to-text (transcription) and text-to-speech capabilities.

AI SDK models are automatically wrapped when passed to `CompositeVoice`, so you can mix and match AI SDK models with existing Mastra voice providers for maximum flexibility.

**Usage Example**

```typescript
import { CompositeVoice } from "@mastra/core/voice";
import { openai } from "@ai-sdk/openai";
import { elevenlabs } from "@ai-sdk/elevenlabs";

// Use AI SDK models directly with CompositeVoice
const voice = new CompositeVoice({
  input: openai.transcription('whisper-1'),      // AI SDK transcription model
  output: elevenlabs.speech('eleven_turbo_v2'),  // AI SDK speech model
});

// Convert text to speech
const audioStream = await voice.speak("Hello from AI SDK!");

// Convert speech to text
const transcript = await voice.listen(audioStream);
console.log(transcript);
```

Fixes #9947
