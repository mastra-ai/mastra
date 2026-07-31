# @mastra/voice-smallest

Smallest AI voice integration for Mastra, providing text-to-speech with Waves Lightning and speech-to-text with Pulse.

## Installation

```bash
npm install @mastra/voice-smallest
```

## Configuration

The module requires a Smallest AI API key, set through an environment variable:

```bash
SMALLEST_API_KEY=your_api_key
```

## Usage

```typescript
import { createReadStream } from 'node:fs';
import { SmallestVoice } from '@mastra/voice-smallest';

// Defaults to the lightning_v3.1_pro pool with automatic language routing
const voice = new SmallestVoice();

// Or configure explicitly
const voice = new SmallestVoice({
  speechModel: {
    apiKey: process.env.SMALLEST_API_KEY,
    model: 'lightning_v3.1_pro',
    language: 'auto',
    sampleRate: 24000,
    speed: 1.0,
  },
  listeningModel: {
    model: 'pulse',
  },
  speaker: 'meher',
});

// List the Lightning voice catalog
const speakers = await voice.getSpeakers();

// Text-to-speech
const audioStream = await voice.speak('Hello from Mastra!', { speaker: 'meher' });

// Speech-to-text
const transcript = await voice.listen(createReadStream('./audio.wav'));
```

## Features

- Sub-second time-to-first-byte, suited to live voice agents
- 200+ voices across 30+ languages, fetched at runtime rather than pinned in the package
- Indian-accent voices that code-switch between English and Hindi when `language` is `auto`
- Configurable sample rate (8kHz–44.1kHz), speed (0.5x–2x), and output format
- Multilingual (`pulse`) and English-optimized (`pulse-pro`) transcription

## Voice Options

`speak()` accepts any voice id from the Lightning catalog, which `getSpeakers()` returns. The catalog is one list covering the standard and Pro pools and carries no per-voice pool flag, so check the [Lightning v3.1](https://docs.smallest.ai/models/model-cards/text-to-speech/lightning-v-3-1) and [Lightning v3.1 Pro](https://docs.smallest.ai/models/model-cards/text-to-speech/lightning-v-3-1-pro) model cards for which pool a voice belongs to — pairing one with the wrong `model` produces unintelligible audio rather than an error.

```typescript
const speakers = await voice.getSpeakers();
const indianVoices = speakers.filter(v => v.tags?.accent === 'indian');
```

## API Reference

### Constructor

| Option           | Type                   | Default   | Description       |
| ---------------- | ---------------------- | --------- | ----------------- |
| `speechModel`    | `SmallestSpeechConfig` | —         | TTS configuration |
| `listeningModel` | `SmallestListenConfig` | —         | STT configuration |
| `speaker`        | `string`               | `'meher'` | Default voice id  |

`speechModel` accepts `apiKey`, `model` (`lightning_v3.1` \| `lightning_v3.1_pro`), `language`, `sampleRate`, `speed`, and `outputFormat` (`wav` \| `mp3` \| `pcm` \| `ulaw` \| `alaw`).

`listeningModel` accepts `apiKey`, `model` (`pulse` \| `pulse-pro`), and `language`.

### Methods

#### speak()

Converts text to speech. Returns `Promise<NodeJS.ReadableStream>`.

Smallest AI accepts at most **250 characters per request** (140 is its optimal chunk size). Longer input throws rather than silently truncating — split on sentence boundaries and speak each segment in order, which is also what keeps time-to-first-audio low in a live agent.

#### listen()

Transcribes pre-recorded audio. Returns `Promise<string>`.

#### getSpeakers()

Returns `Promise<Array<{ voiceId: string; displayName?: string; tags?: SmallestVoiceTags }>>` for the Lightning catalog.

#### getListener()

Returns `Promise<{ enabled: true }>`.
