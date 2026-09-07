# @mastra/voice-openai

Add OpenAI text-to-speech and speech-to-text to Mastra with configurable models, voices, audio formats, synthesis, and transcription.

## Installation

```bash
npm install @mastra/voice-openai
```

## Usage

```typescript
import { OpenAIVoice } from '@mastra/voice-openai';

// Create voice with both speech and listening capabilities
const voice = new OpenAIVoice({
  speechModel: {
    name: 'tts-1', // or 'tts-1-hd' for higher quality
    apiKey: 'your-api-key', // Optional, can use OPENAI_API_KEY env var
  },
  listeningModel: {
    name: 'whisper-1',
    apiKey: 'your-api-key', // Optional, can use OPENAI_API_KEY env var
  },
  speaker: 'alloy', // Default voice
});

// Or create speech-only voice
const speechVoice = new OpenAIVoice({
  speechModel: {
    name: 'tts-1',
    apiKey: 'your-api-key',
  },
  speaker: 'nova',
});

// Or create listening-only voice
const listeningVoice = new OpenAIVoice({
  listeningModel: {
    name: 'whisper-1',
    apiKey: 'your-api-key',
  },
});

// List available voices
const speakers = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'nova', // Optional: override default speaker
  speed: 1.0, // Optional: adjust speech speed
});

// Convert speech to text
const text = await voice.listen(audioStream, {
  filetype: 'wav',
});
```

## Documentation

- [OpenAI](https://mastra.ai/integrations/voice/openai)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/openai/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
