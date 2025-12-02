# @mastra/voice-google

Google Cloud Voice integration for Mastra, providing both Text-to-Speech (TTS) and Speech-to-Text capabilities.

> Note: This package replaces the deprecated @mastra/speech-google package, combining both speech synthesis and recognition capabilities.

## Installation

```bash
npm install @mastra/voice-google
```

## Configuration

The module supports multiple authentication methods:

### Option 1: API Key (Development)

Use an API key from [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

```bash
GOOGLE_API_KEY=your_api_key
```

### Option 2: Service Account (Recommended)

Use a service account key file:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

### Option 3: Vertex AI (Recommended for Production)

Use OAuth authentication with Google Cloud Platform for enterprise deployments:

```bash
# Set project ID
GOOGLE_CLOUD_PROJECT=your_project_id

# Optional: Set location (defaults to us-central1)
GOOGLE_CLOUD_LOCATION=us-central1

# Authenticate via gcloud CLI
gcloud auth application-default login
```

Or use a service account:

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your_project_id
```

## Usage

### Standard Usage

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

### Vertex AI Mode

For enterprise deployments, use Vertex AI mode which provides better integration with Google Cloud infrastructure:

```typescript
import { GoogleVoice } from '@mastra/voice-google';

// Initialize with Vertex AI
const voice = new GoogleVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1', // Optional, defaults to 'us-central1'
  speaker: 'en-US-Studio-O',
});

// Works the same as standard mode
const audioStream = await voice.speak('Hello from Vertex AI!');
const text = await voice.listen(audioStream);

// Check if using Vertex AI
console.log(voice.isUsingVertexAI()); // true
console.log(voice.getProject()); // 'your-gcp-project'
console.log(voice.getLocation()); // 'us-central1'
```

### Vertex AI with Service Account

```typescript
import { GoogleVoice } from '@mastra/voice-google';

const voice = new GoogleVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  speechModel: {
    keyFilename: '/path/to/service-account.json',
  },
  listeningModel: {
    keyFilename: '/path/to/service-account.json',
  },
});
```

### Vertex AI with In-Memory Credentials

```typescript
import { GoogleVoice } from '@mastra/voice-google';

const voice = new GoogleVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  speechModel: {
    credentials: {
      client_email: 'service-account@project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----',
    },
  },
});
```

## API Reference

### Constructor Options

| Option           | Type                | Description                                      |
| ---------------- | ------------------- | ------------------------------------------------ |
| `speechModel`    | `GoogleModelConfig` | Configuration for TTS                            |
| `listeningModel` | `GoogleModelConfig` | Configuration for STT                            |
| `speaker`        | `string`            | Default voice ID (default: `'en-US-Casual-K'`)   |
| `vertexAI`       | `boolean`           | Enable Vertex AI mode (default: `false`)         |
| `project`        | `string`            | Google Cloud project ID (required for Vertex AI) |
| `location`       | `string`            | Google Cloud region (default: `'us-central1'`)   |

### GoogleModelConfig

| Option        | Type     | Description                           |
| ------------- | -------- | ------------------------------------- |
| `apiKey`      | `string` | Google Cloud API key                  |
| `keyFilename` | `string` | Path to service account JSON key file |
| `credentials` | `object` | In-memory service account credentials |

### Methods

#### `speak(input, options?)`

Converts text to speech.

- `input`: `string | NodeJS.ReadableStream` - Text to convert
- `options.speaker`: Override default voice
- `options.languageCode`: Language code (e.g., `'en-US'`)
- `options.audioConfig`: Audio encoding options

Returns: `Promise<NodeJS.ReadableStream>` - Audio stream

#### `listen(audioStream, options?)`

Converts speech to text.

- `audioStream`: `NodeJS.ReadableStream` - Audio to transcribe
- `options.config`: Recognition configuration

Returns: `Promise<string>` - Transcribed text

#### `getSpeakers(options?)`

Lists available voices.

- `options.languageCode`: Filter by language (default: `'en-US'`)

Returns: `Promise<Array<{ voiceId: string, languageCodes: string[] }>>`

#### `isUsingVertexAI()`

Returns `true` if Vertex AI mode is enabled.

#### `getProject()`

Returns the configured Google Cloud project ID.

#### `getLocation()`

Returns the configured Google Cloud location/region.

## Features

- Neural Text-to-Speech synthesis
- Speech-to-Text recognition
- Multiple voice options across different languages
- Streaming support for both speech and transcription
- High-quality audio processing
- Natural-sounding voice synthesis
- **Vertex AI support for enterprise deployments**

## Required Permissions for Vertex AI

When using Vertex AI, ensure your service account or user has the appropriate IAM roles and OAuth scopes:

### IAM Roles

**For Text-to-Speech:**

- `roles/texttospeech.admin` - Text-to-Speech Admin (full access)
- `roles/texttospeech.editor` - Text-to-Speech Editor (create and manage)
- `roles/texttospeech.viewer` - Text-to-Speech Viewer (read-only)

**For Speech-to-Text:**

- `roles/speech.client` - Speech-to-Text Client

### OAuth Scopes

**For synchronous Text-to-Speech synthesis:**

- `https://www.googleapis.com/auth/cloud-platform` - Full access to Google Cloud Platform services

**For long-audio Text-to-Speech operations:**

- `locations.longAudioSynthesize` - Create long-audio synthesis operations
- `operations.get` - Get operation status
- `operations.list` - List operations

## Voice Options

View the complete list using the `getSpeakers()` method or [Google Cloud's documentation](https://cloud.google.com/text-to-speech/docs/voices).
