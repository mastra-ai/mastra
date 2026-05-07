# @mastra/voice-inworld

[Inworld AI](https://inworld.ai) voice provider for [Mastra](https://mastra.ai) — streaming TTS and batch STT.

## Installation

```bash
npm install @mastra/voice-inworld @mastra/core
```

## Quick Start

```typescript
import { InworldVoice } from '@mastra/voice-inworld';

const voice = new InworldVoice({
  speaker: 'Dennis', // 22 built-in voices available
});

// Text-to-Speech (streaming)
const audioStream = await voice.speak('Hello from Inworld!');

// Speech-to-Text
const transcript = await voice.listen(audioStream);

// List available voices
const voices = await voice.getSpeakers();
```

## Configuration

```typescript
const voice = new InworldVoice({
  speechModel: {
    name: 'inworld-tts-2', // default; also 'inworld-tts-1.5-max' or 'inworld-tts-1.5-mini'
    apiKey: 'your-key', // or set INWORLD_API_KEY env var
  },
  listeningModel: {
    name: 'groq/whisper-large-v3',
  },
  speaker: 'Dennis', // default voice
  audioEncoding: 'MP3', // MP3, WAV, OGG_OPUS, LINEAR16, PCM, ALAW, MULAW, FLAC
  sampleRateHertz: 48000, // 8000-48000
  language: 'en-US', // BCP-47 language code for STT
});
```

## Speak Options

```typescript
const stream = await voice.speak('Hello', {
  speaker: 'Olivia', // override voice
  audioEncoding: 'WAV', // override format
  sampleRateHertz: 24000, // override sample rate
  speakingRate: 1.2, // 0.5 - 1.5
  temperature: 0.8, // (0, 2] — ignored on inworld-tts-2
  deliveryMode: 'CREATIVE', // STABLE | BALANCED | CREATIVE — only honored on inworld-tts-2
  language: 'fr-FR', // BCP-47 per-call override; auto-detected when omitted
});
```

## Listen Options

```typescript
const text = await voice.listen(audioStream, {
  audioEncoding: 'AUTO_DETECT', // or 'MP3', 'LINEAR16', etc.
  sampleRateHertz: 16000,
  language: 'en-US',
});
```

## CompositeVoice

Mix Inworld with other providers:

```typescript
import { CompositeVoice } from '@mastra/core/voice';
import { InworldVoice } from '@mastra/voice-inworld';
import { DeepgramVoice } from '@mastra/voice-deepgram';

const voice = new CompositeVoice({
  output: new InworldVoice({ speaker: 'Olivia' }), // Inworld for TTS
  input: new DeepgramVoice(), // Deepgram for STT
});
```

## Available Voices

Alex, Ashley, Craig, Deborah, Dennis, Dominus, Edward, Elizabeth, Hades, Heitor, Julia, Maite, Mark, Olivia, Pixie, Priya, Ronald, Sarah, Shaun, Theodore, Timothy, Wendy.

## TTS Models

| Model                  | Quality | Latency       | Notes                                           |
| ---------------------- | ------- | ------------- | ----------------------------------------------- |
| `inworld-tts-2`        | Highest | ~200ms median | **Default.** Flagship; supports `deliveryMode`. |
| `inworld-tts-1.5-max`  | High    | ~200ms median | Previous flagship. Supports `temperature`.      |
| `inworld-tts-1.5-mini` | Good    | ~100ms median | Lower latency, reduced quality.                 |

## STT Models

| Model                   | Languages | Notes                      |
| ----------------------- | --------- | -------------------------- |
| `groq/whisper-large-v3` | 99+       | Best multilingual coverage |

## Streaming

The `speak()` method uses Inworld's streaming TTS endpoint (`/tts/v1/voice:stream`), returning audio chunks progressively as they are generated. This is ideal for agentic workflows where low time-to-first-audio matters.

## Authentication

Set your API key via the `INWORLD_API_KEY` environment variable or pass it in the config. Get your key from [platform.inworld.ai](https://platform.inworld.ai) → Settings → API Keys.
