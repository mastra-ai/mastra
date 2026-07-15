# @mastra/voice-speechify

Mastra Voice integration with Speechify's API.

## Installation

```bash
npm install @mastra/voice-speechify
```

## Usage

First, set your Speechify API key in your environment:

```bash
export SPEECHIFY_API_KEY=your_api_key_here
```

Then use it in your code:

```typescript
import { SpeechifyVoice } from '@mastra/voice-speechify';

const voice = new SpeechifyVoice({
  speechModel: {
    name: 'simba-3.2', // Optional, defaults to 'simba-english'
    apiKey: 'your-api-key', // Optional, can use SPEECHIFY_API_KEY env var
  },
  speaker: 'harper_32', // Optional, defaults to a voice that matches the model
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello world', {
  speaker: 'harper_32', // Optional, defaults to constructor speaker
  // Additional Speechify options
  audioFormat: 'mp3',
});

// The stream can be piped to a destination
stream.pipe(destination);
```

## Configuration

The `SpeechifyVoice` constructor accepts the following options:

```typescript
interface SpeechifyConfig {
  name?: SpeechifyModel; // Optional Speechify model name (default: 'simba-english')
  apiKey?: string; // Optional API key (can also use env var)
}

new SpeechifyVoice({
  speechModel?: SpeechifyConfig,
  speaker?: string // Optional default speaker ID
})
```

## Available Models

- `simba-3.2`: Speechify's latest streaming-native model with the lowest latency and richest expressivity. Recommended for English. Currently English only.
- `simba-3.0`: The earlier Simba 3 model, still available. Currently English only.
- `simba-english`: The default model, optimized for English.
- `simba-multilingual`: Optimized for non-English or mixed-language input.

The model can also be overridden per request. When overriding to a Simba 3 model, pass a matching speaker too:

```typescript
const stream = await voice.speak('Hello world', { model: 'simba-3.2', speaker: 'harper_32' });
```

## Available Speakers

You can get a list of available speakers:

```typescript
const speakers = await voice.getSpeakers();
```

Voice availability depends on the model:

- `simba-3.2` and `simba-3.0` serve a curated voice set only: `beatrice_32`, `dominic_32`, `edmund_32`, `geffen_32`, `harper_32`, `hugh_32`, `imogen_32`, `wyatt_32`. `simba-3.2` also accepts cloned voices approved by Speechify.
- `simba-english` and `simba-multilingual` serve the full classic catalog (`george`, `henry`, `carly`, ...) and self-serve cloned voices.

The default speaker follows the configured model: `harper_32` for the Simba 3 models, otherwise `george`.
