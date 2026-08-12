# @mastra/voice-gandr

Gandr text to speech for Mastra voice agents. One voice in 23 languages, every render watermarked.

## Install

```bash
npm install @mastra/voice-gandr
```

## Usage

```ts
import { GandrVoice } from '@mastra/voice-gandr';

const voice = new GandrVoice({
  speechModel: {
    name: 'tts-1',
    apiKey: process.env.GANDR_API_KEY,
  },
  speaker: 'alloy',
});
```

Gandr renders WAV by default. The free key starts at 100,000 tokens at gandr.ai.
