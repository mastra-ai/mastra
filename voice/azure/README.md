# @mastra/voice-azure

Add text-to-speech and speech-to-text to Mastra with Azure Speech Services, configurable voices, audio formats, transcription, and credentials.

## Installation

```bash
npm install @mastra/voice-azure
```

## Usage

```typescript
import { AzureVoice } from '@mastra/voice-azure';

// Create voice with both speech and listening capabilities
const voice = new AzureVoice({
  speechModel: {
    apiKey: 'your-api-key', // Optional, can use AZURE_API_KEY env var
    region: 'your-region', // Optional, can use AZURE_REGION env var
    voiceName: 'en-US-AriaNeural', // Optional, default voice
  },
  listeningModel: {
    apiKey: 'your-api-key', // Optional, can use AZURE_API_KEY env var
    region: 'your-region', // Optional, can use AZURE_REGION env var
    language: 'en-US', // Optional, recognition language
  },
});

// List available voices
const voices = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'en-US-JennyNeural', // Optional: override default voice
});

// Convert speech to text
const text = await voice.listen(audioStream);
```

## Documentation

- [Azure](https://mastra.ai/integrations/voice/azure)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/azure/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
