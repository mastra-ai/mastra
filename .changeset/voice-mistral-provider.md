---
'@mastra/voice-mistral': minor
---

Added Mistral voice provider (`@mastra/voice-mistral`) with text-to-speech and speech-to-text support using Mistral's Voxtral audio models.

**Text-to-speech** via `speak()` supports buffered and streaming output, multiple audio formats (mp3, wav, pcm, flac, opus), and one-off voice cloning via reference audio.

**Speech-to-text** via `listen()` supports batch transcription with speaker diarization, context biasing, and timestamp granularity.

**Voice discovery** via `getSpeakers()` fetches available preset voices from the Mistral Voices API.

```ts
import { MistralVoice } from '@mastra/voice-mistral'

const voice = new MistralVoice()

// Text-to-speech
const audioStream = await voice.speak('Hello from Mistral')

// Speech-to-text
const text = await voice.listen(audioStream, { language: 'en' })

// Streaming TTS
const stream = await voice.speak('Hello', { stream: true, responseFormat: 'pcm' })
```
