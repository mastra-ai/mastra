# @mastra/voice-elevenlabs

ElevenLabs Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using ElevenLabs' advanced AI voice technology.

## Installation

```bash
npm install @mastra/voice-elevenlabs
```

## Configuration

The module requires the following environment variable:

```bash
ELEVENLABS_API_KEY=your_api_key
```

## Usage

```typescript
import { ElevenLabsVoice } from '@mastra/voice-elevenlabs';

// Initialize with configuration
const voice = new ElevenLabsVoice({
  speechModel: {
    name: 'eleven_multilingual_v2',
    apiKey: 'your-api-key', // Optional, can use ELEVENLABS_API_KEY env var
  },
  speaker: 'Adam', // Default speaker
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello from Mastra!', {
  speaker: 'Adam', // Optional, defaults to constructor speaker
});

// Generate speech with custom output format (e.g., for telephony/VoIP)
const telephonyStream = await voice.speak('Hello from Mastra!', {
  speaker: 'Adam',
  outputFormat: 'ulaw_8000', // μ-law 8kHz format for telephony systems
});
```

## Features

- High-fidelity Text-to-Speech synthesis
- Configurable audio output formats (MP3, PCM, μ-law, A-law, WAV) for telephony and VoIP use cases

## Voice Options

ElevenLabs provides a variety of premium voices with different characteristics:

- Adam (Male)
- Antoni (Male)
- Arnold (Male)
- Bella (Female)
- Dorothy (Female)
- Elli (Female)
- Josh (Male)
- Rachel (Female)
- Sam (Male)

View the complete list of voices through the `getSpeakers()` method or in [ElevenLabs' documentation](https://docs.elevenlabs.io/api-reference/voices).

## API Reference

### Constructor

```typescript
new ElevenLabsVoice({
  speechModel?: {
    name?: ElevenLabsModel, // Default: 'eleven_multilingual_v2'
    apiKey?: string,        // Optional, can use ELEVENLABS_API_KEY env var
  },
  speaker?: string         // Default speaker ID
})
```

### Methods

#### `getSpeakers()`

Returns a list of available speakers with their details.

#### `speak(input: string | NodeJS.ReadableStream, options?: { speaker?: string; outputFormat?: ElevenLabsOutputFormat })`

Converts text to speech. Returns a readable stream of audio data.

**Options:**

- `speaker?: string` - The ID of the speaker to use for the speech. If not provided, the default speaker will be used.
- `outputFormat?: ElevenLabsOutputFormat` - The audio output format. Supported formats include:
  - **MP3 formats**: `mp3_22050_32`, `mp3_44100_32`, `mp3_44100_64`, `mp3_44100_96`, `mp3_44100_128`, `mp3_44100_192`
  - **PCM formats**: `pcm_8000`, `pcm_16000`, `pcm_22050`, `pcm_24000`, `pcm_44100`
  - **Telephony formats**: `ulaw_8000`, `alaw_8000` (μ-law and A-law 8kHz for VoIP/telephony)
  - **WAV formats**: `wav`, `wav_8000`, `wav_16000`

If not provided, defaults to ElevenLabs' default format (typically `mp3_44100_128`).

#### `listen()`

Not supported - ElevenLabs does not provide speech recognition.
