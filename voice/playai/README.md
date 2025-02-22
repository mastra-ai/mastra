# @mastra/voice-playai

PlayAI Voice integration for Mastra, providing Text-to-Speech (TTS) capabilities using PlayAI's voice synthesis technology.

## Installation

```bash
npm install @mastra/voice-playai
```

## Configuration

The module requires the following environment variables:

```bash
PLAYAI_API_KEY=your_api_key
PLAYAI_USER_ID=your_user_id
```

## Usage

```typescript
import { PlayAIVoice } from '@mastra/voice-playai';

// Initialize with configuration
const voice = new PlayAIVoice({
  speechModel: {
    name: 'PlayDialog', // Optional, defaults to 'PlayDialog'
    apiKey: 'your-api-key', // Optional, can use PLAYAI_API_KEY env var
    userId: 'your-user-id', // Optional, can use PLAYAI_USER_ID env var
  },
  speaker: 's3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json', // Optional, defaults to first available voice
});

// Or use with defaults (using env vars)
const defaultVoice = new PlayAIVoice();

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech from text
const stream = await voice.speak('Hello from Mastra!');

// Or generate speech from a text stream
const textStream = getTextStream(); // Your text stream source
const audioStream = await voice.speak(textStream);

// The stream can be piped to a destination
stream.pipe(destination);
```

## Features

- High-quality Text-to-Speech synthesis
- Multiple voice options
- Streaming support for both input and output
- Natural and expressive speech output
- Voice customization options

## Available Voices

PlayAI offers a diverse selection of voices with different characteristics:

### Conversational Style

- Angelo (US, Young Male)
  - ID: `s3://voice-cloning-zero-shot/baf1ef41-36b6-428c-9bdf-50ba54682bd8/original/manifest.json`
- Arsenio (US African American, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/65977f5e-a22a-4b36-861b-ecede19bdd65/original/manifest.json`
- Cillian (Irish, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/1591b954-8760-41a9-bc58-9176a68c5726/original/manifest.json`
- Timo (US, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/677a4ae3-252f-476e-85ce-eeed68e85951/original/manifest.json`
- Dexter (US, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/b27bc13e-996f-4841-b584-4d35801aea98/original/manifest.json`
- Miles (US African American, Young Male)
  - ID: `s3://voice-cloning-zero-shot/29dd9a52-bd32-4a6e-bff1-bbb98dcc286a/original/manifest.json`
- Briggs (US Southern/Oklahoma, Elderly Male)
  - ID: `s3://voice-cloning-zero-shot/71cdb799-1e03-41c6-8a05-f7cd55134b0b/original/manifest.json`
- Deedee (US African American, Middle-aged Female)
  - ID: `s3://voice-cloning-zero-shot/e040bd1b-f190-4bdb-83f0-75ef85b18f84/original/manifest.json`
- Nia (US, Young Female)
  - ID: `s3://voice-cloning-zero-shot/831bd330-85c6-4333-b2b4-10c476ea3491/original/manifest.json`
- Inara (US African American, Middle-aged Female)
  - ID: `s3://voice-cloning-zero-shot/adb83b67-8d75-48ff-ad4d-a0840d231ef1/original/manifest.json`
- Constanza (US Latin American, Young Female)
  - ID: `s3://voice-cloning-zero-shot/b0aca4d7-1738-4848-a80b-307ac44a7298/original/manifest.json`

### Narrative Style

- Gideon (British, Elderly Male)
  - ID: `s3://voice-cloning-zero-shot/5a3a1168-7793-4b2c-8f90-aff2b5232131/original/manifest.json`
- Casper (US, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/1bbc6986-fadf-4bd8-98aa-b86fed0476e9/original/manifest.json`
- Mitch (Australian, Middle-aged Male)
  - ID: `s3://voice-cloning-zero-shot/c14e50f2-c5e3-47d1-8c45-fa4b67803d19/original/manifest.json`
- Ava (Australian, Middle-aged Female)
  - ID: `s3://voice-cloning-zero-shot/50381567-ff7b-46d2-bfdc-a9584a85e08d/original/manifest.json`

Each voice includes metadata about accent, gender, age, and speaking style. Use the voice ID when specifying a speaker.

## API Reference

### Constructor

```typescript
new PlayAIVoice({
  speechModel?: {
    name?: 'PlayDialog' | 'Play3.0-mini', // Default: 'PlayDialog'
    apiKey?: string,                      // Optional, can use PLAYAI_API_KEY env var
    userId?: string,                      // Optional, can use PLAYAI_USER_ID env var
  },
  speaker?: string                        // Optional, defaults to first available voice ID
})
```

### Methods

#### `speak(input: string | NodeJS.ReadableStream, options?: { speaker?: string })`

Converts text to speech. The speaker option should be a voice ID. Returns a readable stream of audio data.

#### `getSpeakers()`

Returns a list of available speakers with their details including voice IDs.

#### `listen()`

Not supported - PlayAI does not provide speech recognition.
