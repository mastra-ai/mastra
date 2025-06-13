# @mastra/voice-gladia

Gladia AI Voice integration for Mastra, providing Speech-to-text (STT) capabilities using Gladia's voice technology.

## Installation

```bash
npm install @mastra/voice-gladia
```

## Configuration

The module requires the following environment variable:

```bash
GLADIA_API_KEY=your_api_key
```

## Usage

```typescript
import { GladiaVoice } from '@mastra/voice-gladia';
import { createReadStream } from 'fs';
import path from 'path';

const voice = new GladiaVoice({
  listeningModel: {
    apiKey: process.env.GLADIA_API_KEY!,
  },
});

// Create an agent with voice capabilities
// Note: Gladia only supports STT, so the agent will only be able to listen.
export const agent = new Agent({
  name: 'Agent',
  instructions: `You are a helpful assistant with STT capabilities.`,
  model: google('gemini-1.5-pro-latest'),
  voice: voice,
});

// Example usage with a local audio file
const audioStream = createReadStream(path.join(process.cwd(), 'audio.m4a'));

try {
  const text = await voice.listen(audioStream, {
    fileName: 'audio.m4a',
    mimeType: 'audio/mp4',
  });
  console.log('Transcription:', text);
} catch (error) {
  console.error('Error transcribing audio:', error);
}
```

## Features

- High-quality Speech-to-Text recognition
- Support for various audio formats
- Advanced diarization and translation options
- Easy integration with Mastra agents

## Limitations

- Only supports Speech-to-Text (STT) functionality. Text-to-Speech (TTS) is not supported.

## Available Voices

Gladia does not expose a list of available "voices" in the traditional sense. The service focuses on providing high-quality transcription across various languages and audio characteristics.

### Languages

Gladia supports a wide range of languages. For a complete list, please refer to the [Gladia documentation](https://docs.gladia.io/).
