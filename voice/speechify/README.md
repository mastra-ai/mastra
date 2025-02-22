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
    name: 'simba-english', // Optional, defaults to 'simba-english'
    apiKey: 'your-api-key', // Optional, can use SPEECHIFY_API_KEY env var
  },
  speaker: 'george', // Optional, defaults to 'george'
});

// List available speakers
const speakers = await voice.getSpeakers();

// Generate speech
const stream = await voice.speak('Hello world', {
  speaker: 'george', // Optional, defaults to constructor speaker
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
  name?: string; // Optional Speechify model name (default: 'simba-english')
  apiKey?: string; // Optional API key (can also use env var)
}

new SpeechifyVoice({
  speechModel?: SpeechifyConfig,
  speaker?: string // Optional default speaker ID
})
```

## Available Speakers

You can get a list of available speakers:

```typescript
const speakers = await voice.getSpeakers();
```

## License

MIT
