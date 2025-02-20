# @mastra/speech-replicate

Replicate Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using various AI models hosted on Replicate.

## Installation

```bash
npm install @mastra/speech-replicate
```

## Configuration

The module requires the following environment variable:

```bash
REPLICATE_API_TOKEN=your_api_token
```

## Usage

```typescript
import { ReplicateTTS } from '@mastra/speech-replicate';

// Initialize with configuration
const tts = new ReplicateTTS({
  model: {
    name: 'default', // Default model
    apiToken: 'your-api-token', // Optional, can use REPLICATE_API_TOKEN env var
  },
});

// List available models
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'model-id',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'model-id',
  text: 'Hello from Mastra!',
});
```

## Features

- Access to multiple TTS models
- High-quality speech synthesis
- Streaming support
- Model version control
- Various voice options

## Model Options

Replicate provides access to various TTS models:

- Coqui TTS
- Bark
- Tortoise
- Facebook MMS
- And more...

Each model has its own unique characteristics and capabilities. View the available models in the `voices.ts` file or [Replicate's model collection](https://replicate.com/collections/text-to-speech).

## Additional Features

- Model version selection
- Custom model parameters
- Multiple output formats
- Batch processing
- Progress tracking
