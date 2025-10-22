# @mastra/voice-google

Google Cloud Voice integration for Mastra, providing both Text-to-Speech (TTS) and Speech-to-Text capabilities.

> Note: This package replaces the deprecated @mastra/speech-google package, combining both speech synthesis and recognition capabilities.

## Installation

```bash
npm install @mastra/voice-google
```

## Configuration

You can authenticate in one of the following ways:

```bash
GOOGLE_API_KEY=your_api_key
# or provide a service account key picked up by ADC
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Usage

```typescript
import { GoogleVoice } from '@mastra/voice-google';

// Initialize with configuration
const voice = new GoogleVoice({
  speechModel: {
    apiKey: 'your-api-key', // Optional, can rely on GOOGLE_API_KEY or ADC
    keyFilename: '/path/to/service-account.json', // Optional, can rely on GOOGLE_APPLICATION_CREDENTIALS
  },
  listeningModel: {
    keyFilename: '/path/to/service-account.json', // Optional, can rely on ADC
  },
  speaker: 'en-US-Standard-F', // Default voice
});

// List available voices
const voices = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'en-US-Standard-F',
  languageCode: 'en-US',
});

// Transcribe speech
const text = await voice.listen(audioStream);
```

## Features

- Neural Text-to-Speech synthesis
- Speech-to-Text recognition
- Multiple voice options across different languages
- Streaming support for both speech and transcription
- High-quality audio processing
- Natural-sounding voice synthesis

## Voice Options

View the complete list using the `getSpeakers()` method or [Google Cloud's documentation](https://cloud.google.com/text-to-speech/docs/voices).
