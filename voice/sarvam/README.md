# @mastra/voice-sarvam

Sarvam Voice integration for Mastra, providing Text-to-Speech (TTS) and Speech-to-text (STT) capabilities using Sarvam's voice technology.

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

## Features

- High-quality Text-to-Speech and Speech-to-Text synthesis
- Support for 11 Indian languages
- 46 speakers across `bulbul:v2` and `bulbul:v3`
- Multi-mode Speech-to-Text via `saaras:v3` (transcribe, translate, verbatim, translit, codemix)

## Available Voices

Speaker catalogs are not interchangeable between `bulbul:v2` and `bulbul:v3` — pick a speaker compatible with your selected TTS model.

### Speakers for `bulbul:v3` and `bulbul:v3-beta` (39 voices)

`shubh` (default), `aditya`, `ritu`, `priya`, `neha`, `rahul`, `pooja`, `rohan`, `simran`, `kavya`, `amit`, `dev`, `ishita`, `shreya`, `ratan`, `varun`, `manan`, `sumit`, `roopa`, `kabir`, `aayan`, `ashutosh`, `advait`, `amelia`, `sophia`, `anand`, `tanya`, `tarun`, `sunny`, `mani`, `gokul`, `vijay`, `shruti`, `suhani`, `mohit`, `kavitha`, `rehan`, `soham`, `rupali`

### Speakers for `bulbul:v2` (7 voices)

`anushka` (default), `manisha`, `vidya`, `arya`, `abhilash`, `karun`, `hitesh`

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
