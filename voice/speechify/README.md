# @mastra/speech-speechify

Mastra Text-to-Speech integration with Speechify's API.

## Installation

```bash
npm install @mastra/speech-speechify
```

## Usage

First, set your Speechify API key in your environment:

```bash
export SPEECHIFY_API_KEY=your_api_key_here
```

Then use it in your code:

```typescript
import { SpeechifyTTS } from '@mastra/speech-speechify';

const tts = new SpeechifyTTS({
  model: {
    name: 'simba-multilingual',
    voice: 'george', // Optional, defaults to 'george'
    properties: {
      // Optional additional properties
      audioFormat: 'mp3',
      // ... other Speechify options
    },
  },
});

// Generate audio
const { audioResult } = await tts.generate({ text: 'Hello world' });

// Or stream it
const { audioResult: stream } = await tts.stream({ text: 'Hello world' });
```

## Configuration

The `SpeechifyTTS` constructor accepts the following options:

```typescript
interface SpeechifyConfig {
  name: string; // Speechify model name
  apiKey?: string; // Optional API key (can also use env var)
  voice?: SpeechifyVoice; // Optional voice ID
  properties?: {
    // Optional additional properties
    audioFormat?: string;
    // ... other Speechify options
  };
}
```

## Available Voices

You can get a list of available voices:

```typescript
const voices = await tts.voices();
```

## License

MIT
