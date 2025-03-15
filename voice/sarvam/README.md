# @mastra/voice-sarvam

Sarvam Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using Sarvam's voice technology.

## Installation

```bash
npm install @mastra/voice-sarvam
```

## Configuration

The module requires the following environment variables:

```bash
SARVAM_API_KEY=your_api_key
```

## Usage

```typescript
import { SarvamVoice } from '@mastra/voice-sarvam';

const voice = new CompositeVoice({
  speakProvider: new SarvamVoice({
    speechModel: { apiKey: 'YOUR-API-KEY' },
    speaker: 'meera',
  }),
});

// Create an agent with voice capabilities
export const agent = new Agent({
  name: 'Agent',
  instructions: `You are a helpful assistant with voice capabilities.`,
  model: google('gemini-1.5-pro-latest'),
  voice: voice,
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech and save to file
const audio = await agent.speak("Hello, I'm your AI assistant!");
const filePath = path.join(process.cwd(), 'agent.mp3');
const writer = createWriteStream(filePath);

audio.pipe(writer);

await new Promise<void>((resolve, reject) => {
  writer.on('finish', () => resolve());
  writer.on('error', reject);
});

// Generate speech from a text stream
const textStream = getTextStream(); // Your text stream source
const audioStream = await voice.speak(textStream);

// The stream can be piped to a destination
const streamFilePath = path.join(process.cwd(), 'stream.mp3');
const streamWriter = createWriteStream(streamFilePath);

audioStream.pipe(streamWriter);

console.log(`Speech saved to ${filePath} and ${streamFilePath}`);
```

## Features

- High-quality Text-to-Speech synthesis
- Support for 10+ Indian languages
- Choice of 10+ diverse speakers
- Advanced voice customization options

## Available Voices

### Speakers

- `meera` (default)
- `pavithra`
- `maitreyi`
- `arvind`
- `amol`
- `amartya`
- `diya`
- `neel`
- `misha`
- `vian`
- `arjun`
- `maya`

### Languages

| Language  | Code  |
| --------- | ----- |
| English   | en-IN |
| Hindi     | hi-IN |
| Bengali   | bn-IN |
| Kannada   | kn-IN |
| Malayalam | ml-IN |
| Marathi   | mr-IN |
| Odia      | od-IN |
| Punjabi   | pa-IN |
| Tamil     | ta-IN |
| Telugu    | te-IN |
| Gujarati  | gu-IN |
