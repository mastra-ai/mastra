# @mastra/voice-mistral

[Mistral](https://mistral.ai) voice provider for [Mastra](https://mastra.ai) — text-to-speech and speech-to-text using Mistral's Voxtral audio models.

## Installation

```bash
npm install @mastra/voice-mistral
```

## Quick Start

```typescript
import { MistralVoice } from '@mastra/voice-mistral';

const voice = new MistralVoice(); // uses MISTRAL_API_KEY

// Text-to-Speech
const audioStream = await voice.speak('Hello from Mistral!');

// Speech-to-Text
const transcript = await voice.listen(audioStream);

// List available preset voices
const speakers = await voice.getSpeakers();
```

## Configuration

```typescript
const voice = new MistralVoice({
  speechModel: {
    name: 'voxtral-mini-tts-2603', // default TTS model
    apiKey: 'your-key', // or set MISTRAL_API_KEY env var
  },
  listeningModel: {
    name: 'voxtral-mini-latest', // default STT model
  },
  speaker: 'en_paul_neutral', // default voice
});
```

## Speak Options

```typescript
const stream = await voice.speak('Hello', {
  speaker: 'en_paul_neutral', // override voice
  responseFormat: 'wav', // pcm | wav | mp3 | flac | opus
  refAudio: base64Audio, // one-off voice cloning (2-3s minimum)
  model: 'voxtral-mini-tts-2603', // per-call model override
  stream: true, // stream audio chunks as they arrive
});
```

## Listen Options

```typescript
const text = await voice.listen(audioStream, {
  language: 'en',
  diarize: true, // speaker diarization
  contextBias: ['Mastra', 'Voxtral'], // vocabulary guidance
  timestampGranularities: ['segment'],
  filetype: 'mp3', // extension hint for the input stream
});
```

## CompositeVoice

Mix Mistral with other providers:

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { MistralVoice } from '@mastra/voice-mistral';

const voice = new CompositeVoice({
  input: new MistralVoice(), // Voxtral for STT
  output: new MistralVoice(), // Voxtral for TTS
});
```

## Authentication

Set your API key via the `MISTRAL_API_KEY` environment variable or pass it in the config. Get your key from [console.mistral.ai](https://console.mistral.ai).
