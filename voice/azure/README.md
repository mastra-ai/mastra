# @mastra/speech-azure

Azure Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using Azure's Neural Voice technology.

## Installation

```bash
npm install @mastra/speech-azure
```

## Configuration

The module requires the following environment variables:

```bash
AZURE_API_KEY=your_api_key
AZURE_REGION=your_region # e.g., eastus, westus2
```

## Usage

```typescript
import { AzureTTS } from '@mastra/speech-azure';

// Initialize with configuration
const tts = new AzureTTS({
  model: {
    name: 'en-US-AriaNeural', // Default voice
    apiKey: 'your-api-key', // Optional, can use AZURE_API_KEY env var
    region: 'your-region', // Optional, can use AZURE_REGION env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US-AriaNeural',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US-AriaNeural',
  text: 'Hello from Mastra!',
});
```

## Features

- Neural Text-to-Speech synthesis
- 400+ neural voices across 100+ languages and variants
- Streaming support
- High-quality speech output
- Natural-sounding voice synthesis

## Voice Options

The module provides access to all Azure Neural voices. Some popular English voices include:

- en-US-AriaNeural (Female)
- en-US-GuyNeural (Male)
- en-US-JennyNeural (Female)
- en-GB-SoniaNeural (Female)
- en-AU-NatashaNeural (Female)

View the complete list in the `voices.ts` file or [Azure's documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts).
