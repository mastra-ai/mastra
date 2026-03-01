# @mastra/voice-modelslab

[ModelsLab](https://modelslab.com) voice integration for Mastra. Provides text-to-speech using ModelsLab's TTS API.

## Installation

```bash
npm install @mastra/voice-modelslab
```

## Usage

```typescript
import { ModelsLabVoice } from '@mastra/voice-modelslab';

const voice = new ModelsLabVoice({
  speechModel: {
    apiKey: process.env.MODELSLAB_API_KEY,
  },
  speaker: '5', // Female voice
});

// Text to speech
const audioStream = await voice.speak('Hello, world!', {
  speaker: 'nova',  // OpenAI-style voices also work: alloy, echo, fable, onyx, nova, shimmer
  language: 'english',
  speed: 1.0,
});

// List available voices
const speakers = await voice.getSpeakers();
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `speechModel.apiKey` | `string` | `MODELSLAB_API_KEY` env | ModelsLab API key |
| `speaker` | `string` | `'1'` | Default voice ID (1–10) or OpenAI voice name |

## Voice IDs

| ID | Name | Gender |
|----|------|--------|
| 1 | Neutral | neutral |
| 2 | Male | male |
| 3 | Warm | male |
| 4 | Deep Male | male |
| 5 | Female | female |
| 6 | Clear Female | female |

OpenAI voice names are also accepted: `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`.

## API Reference

See [ModelsLab TTS docs](https://docs.modelslab.com) for full API details.

ModelsLab uses key-in-body authentication (`MODELSLAB_API_KEY`) and asynchronous audio generation with polling.
