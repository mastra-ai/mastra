# @mastra/voice-sarvam

Add Sarvam AI text-to-speech and speech-to-text to Mastra with configurable Indian languages, speakers, audio formats, and translation options.

## Installation

```bash
npm install @mastra/voice-sarvam
```

## Usage

```typescript
import { SarvamVoice } from '@mastra/voice-sarvam';

const voice = new SarvamVoice({
  speechModel: {
    model: 'bulbul:v3',
    apiKey: process.env.SARVAM_API_KEY!,
    language: 'en-IN',
  },
  listeningModel: {
    apiKey: process.env.SARVAM_API_KEY!,
    model: 'saarika:v2.5',
    languageCode: 'unknown',
  },
  speaker: 'shubh',
});

// Create an agent with voice capabilities
export const agent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent'
  instructions: `You are a helpful assistant with both TTS and STT capabilities.`,
  model: google('gemini-1.5-pro-latest'),
  voice: voice,
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech and save to file
const audio = await agent.voice.speak("Hello, I'm your AI assistant!");
const filePath = path.join(process.cwd(), 'agent.wav');
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

// Generate Text from an audio stream
const text = await voice.listen(audioStream);
```

## Documentation

- [Sarvam](https://mastra.ai/integrations/voice/sarvam)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/voice/sarvam/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
