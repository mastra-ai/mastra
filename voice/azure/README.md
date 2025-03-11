# @mastra/voice-azure

Azure Voice integration for Mastra, providing both Text-to-Speech (TTS) and Speech-to-Text (STT) capabilities using Azure's Cognitive Services Speech SDK.

## Installation

```bash
npm install @mastra/voice-azure
```

## Configuration

The module requires Azure Speech Services credentials that can be provided through environment variables or directly in the configuration:

```bash
AZURE_API_KEY=your_speech_service_key
AZURE_REGION=your_azure_region
```

## Usage

```typescript
import { AzureVoice } from '@mastra/voice-azure';

// Create voice with both speech and listening capabilities
const voice = new AzureVoice({
  speechModel: {
    apiKey: 'your-api-key',  // Optional, can use AZURE_API_KEY env var
    region: 'your-region',   // Optional, can use AZURE_REGION env var
    voiceName: 'en-US-AriaNeural' // Optional, default voice
  },
  listeningModel: {
    apiKey: 'your-api-key',  // Optional, can use AZURE_API_KEY env var
    region: 'your-region',   // Optional, can use AZURE_REGION env var
    language: 'en-US'        // Optional, recognition language
  }
});

// List available voices
const voices = await voice.getSpeakers();

// Generate speech
const audioStream = await voice.speak('Hello from Mastra!', {
  speaker: 'en-US-JennyNeural' // Optional: override default voice
});

// Convert speech to text
const text = await voice.listen(audioStream, {
  filetype: 'wav' // Supported formats: mp3, mp4, wav, webm, m4a
});
```

## Features

- High-quality neural Text-to-Speech synthesis
- Accurate Speech-to-Text recognition
- 200+ neural voices across multiple languages
- SSML support
- Real-time audio streaming
- Multiple audio format support

## Voice Options

Azure provides numerous neural voices across different languages. Here are some popular English voices:

- en-US-JennyNeural (Female)
- en-US-GuyNeural (Male)
- en-US-AriaNeural (Female)
- en-US-DavisNeural (Male)
- en-GB-SoniaNeural (Female)
- en-GB-RyanNeural (Male)
- en-AU-NatashaNeural (Female)
- en-AU-WilliamNeural (Male)

Each voice ID follows the format: `{language}-{region}-{name}Neural`

For a complete list of supported voices, you can:
1. Call the `getSpeakers()` method
2. View the [Azure Neural TTS documentation](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-support?tabs=tts)