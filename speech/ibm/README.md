# @mastra/speech-ibm

IBM Watson Speech integration for Mastra, providing Text-to-Speech (TTS) capabilities using IBM Watson's Neural Voice technology.

## Installation

```bash
npm install @mastra/speech-ibm
```

## Configuration

The module requires the following environment variables:

```bash
IBM_API_KEY=your_api_key
IBM_URL=your_service_url
```

## Usage

```typescript
import { IBMTTS } from '@mastra/speech-ibm';

// Initialize with configuration
const tts = new IBMTTS({
  model: {
    name: 'en-US_AllisonV3Voice', // Default voice
    apiKey: 'your-api-key', // Optional, can use IBM_API_KEY env var
    url: 'your-service-url', // Optional, can use IBM_URL env var
  },
});

// List available voices
const voices = await tts.voices();

// Generate speech
const result = await tts.generate({
  voice: 'en-US_AllisonV3Voice',
  text: 'Hello from Mastra!',
});

// Stream speech
const stream = await tts.stream({
  voice: 'en-US_AllisonV3Voice',
  text: 'Hello from Mastra!',
});
```

## Features

- Neural Text-to-Speech synthesis
- Multiple voice options across different languages
- Streaming support
- SSML support
- Word timing information
- Custom dictionary support

## Voice Options

IBM Watson provides various neural voices across multiple languages:

- en-US_AllisonV3Voice (Female)
- en-US_MichaelV3Voice (Male)
- en-US_LisaV3Voice (Female)
- en-GB_CharlotteV3Voice (Female)
- en-GB_JamesV3Voice (Male)

View the complete list in the `voices.ts` file or [IBM Watson's documentation](https://cloud.ibm.com/docs/text-to-speech?topic=text-to-speech-voices).

## Additional Features

- Expressive SSML tags support
- Custom pronunciation
- Voice transformation
- Background audio mixing
- Real-time speech synthesis
