# @mastra/voice-google-gemini-live

Google Gemini Live API integration for Mastra, providing real-time multimodal voice interactions with advanced capabilities including video input, tool calling, and session management.

## Installation

```bash
npm install @mastra/voice-google-gemini-live
```

## Configuration

The module supports two authentication methods:

### Option 1: Gemini API (Recommended for development)

Use an API key from [Google AI Studio](https://makersuite.google.com/app/apikey):

```bash
# Set environment variable
GOOGLE_API_KEY=your_api_key
```

### Option 2: Vertex AI (Recommended for production)

Use OAuth authentication with Google Cloud Platform. There are multiple ways to authenticate:

#### Application Default Credentials (ADC)

```bash
# Install gcloud CLI and authenticate
gcloud auth application-default login

# Set project ID
GOOGLE_CLOUD_PROJECT=your_project_id
```

#### Service Account Key File

```bash
# Set path to service account JSON
GOOGLE_APPLICATION_CREDENTIALS=path/to/service-account.json
GOOGLE_CLOUD_PROJECT=your_project_id
```

#### Service Account in Code

```typescript
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-gcp-project',
  location: 'us-central1',
  serviceAccountKeyFile: '/path/to/service-account.json',
  // OR use service account email for impersonation
  serviceAccountEmail: 'service-account@project.iam.gserviceaccount.com',
});
```

### Required Permissions for Vertex AI

When using Vertex AI, ensure your service account or user has these IAM roles:

- `aiplatform.user` or specific permissions:
  - `aiplatform.endpoints.predict`
  - `aiplatform.models.predict`

## Usage

```typescript
import { GeminiLiveVoice } from '@mastra/voice-google-gemini-live';

// Initialize with Gemini API
const voice = new GeminiLiveVoice({
  apiKey: 'your-api-key', // Optional, can use GOOGLE_API_KEY env var
  model: 'gemini-2.0-flash-live-001',
  speaker: 'Puck', // Default voice
});

// OR initialize with Vertex AI (recommended for production)
const voice = new GeminiLiveVoice({
  vertexAI: true,
  project: 'your-project-id',
  model: 'gemini-2.0-flash-live-001',
  speaker: 'Puck',
});

// Connect to the Live API
await voice.connect();

// Listen for responses
voice.on('speaking', ({ audioData }) => {
  // Handle audio response as Int16Array
  playAudio(audioData);
});

// Or subscribe to a concatenated audio stream per response
voice.on('speaker', audioStream => {
  audioStream.pipe(playbackDevice);
});

voice.on('writing', ({ text, role }) => {
  // Handle transcribed text
  console.log(`${role}: ${text}`);
});

// Send text to speech
await voice.speak('Hello from Mastra!');

// Send audio stream
const microphoneStream = getMicrophoneStream();
await voice.send(microphoneStream);

// When done, disconnect
voice.disconnect();
```

## API Reference

### Constructor

**`new GeminiLiveVoice(options?: GeminiLiveVoiceConfig)`**

Creates a new GeminiLiveVoice instance.

**Parameters:**

- `options` (optional): Configuration object
  - `apiKey?: string` - Google API key (falls back to GOOGLE_API_KEY env var)
  - `model?: GeminiVoiceModel` - Model to use (default: 'gemini-2.0-flash-exp')
  - `speaker?: GeminiVoiceName` - Voice to use (default: 'Puck')
  - `vertexAI?: boolean` - Use Vertex AI instead of Gemini API
  - `project?: string` - Google Cloud project ID (required for Vertex AI)
  - `location?: string` - Google Cloud region (default: 'us-central1')
  - `serviceAccountKeyFile?: string` - Path to service account JSON key file
  - `serviceAccountEmail?: string` - Service account email for impersonation
  - `instructions?: string` - System instructions for the model
  - `tools?: GeminiToolConfig[]` - Tools available to the model
  - `sessionConfig?: GeminiSessionConfig` - Session configuration
  - `audioConfig?: Partial<AudioConfig>` - Audio configuration
  - `debug?: boolean` - Enable debug logging

### Connection Management

**`async connect(): Promise<void>`**

Establishes connection to the Gemini Live API. Must be called before using other methods.

**Returns:** Promise that resolves when connection is established

**Throws:** Error if connection fails or authentication is invalid

---

**`async disconnect(): Promise<void>`**

Disconnects from the Gemini Live API and cleans up resources.

**Returns:** Promise that resolves when disconnection is complete

---

**`getConnectionState(): 'disconnected' | 'connected'`**

Gets the current connection state.

**Returns:** Current connection state

---

**`isConnected(): boolean`**

Checks if currently connected to the API.

**Returns:** true if connected, false otherwise

---

Connection lifecycle transitions such as "connecting", "disconnecting", and "updated" are emitted via the `session` event:

```ts
voice.on('session', data => {
  // data.state is one of: 'connecting' | 'connected' | 'disconnected' | 'disconnecting' | 'updated'
});
```

### Audio and Speech

**`async speak(input: string | NodeJS.ReadableStream, options?: GeminiLiveVoiceOptions): Promise<void>`**

Converts text to speech and sends it to the model.

**Parameters:**

- `input: string | NodeJS.ReadableStream` - Text to convert to speech
- `options?: GeminiLiveVoiceOptions` - Optional speech options
  - `speaker?: GeminiVoiceName` - Override the default speaker
  - `languageCode?: string` - Language code for the response
  - `responseModalities?: ('AUDIO' | 'TEXT')[]` - Response modalities

**Returns:** Promise<void> (responses are emitted via `speaker` and `writing` events)

**Throws:** Error if not connected or input is empty

---

**`async send(audioData: NodeJS.ReadableStream | Int16Array): Promise<void>`**

Sends audio data for real-time processing.

**Parameters:**

- `audioData: NodeJS.ReadableStream | Int16Array` - Audio data to send

**Returns:** Promise that resolves when audio is sent

**Throws:** Error if not connected or audio format is invalid

---

**`async listen(audioStream: NodeJS.ReadableStream, options?: GeminiLiveVoiceOptions): Promise<string>`**

Processes audio stream for speech-to-text transcription.

**Parameters:**

- `audioStream: NodeJS.ReadableStream` - Audio stream to transcribe
- `options?: GeminiLiveVoiceOptions` - Optional transcription options

**Returns:** Promise that resolves to transcribed text

**Throws:** Error if not connected, audio format is invalid, or transcription fails

---

**`getCurrentSpeakerStream(): NodeJS.ReadableStream | null`**

Gets the current concatenated audio stream for the active response.

**Returns:** ReadableStream of concatenated audio chunks, or null if no active stream

### Session Management

**`async updateSessionConfig(config: Partial<GeminiLiveVoiceConfig>): Promise<void>`**

Updates session configuration during an active session.

**Parameters:**

- `config: Partial<GeminiLiveVoiceConfig>` - Configuration to update
  - `speaker?: GeminiVoiceName` - Change voice/speaker
  - `instructions?: string` - Update system instructions
  - `tools?: GeminiToolConfig[]` - Update available tools
  - `sessionConfig?: GeminiSessionConfig` - Update session settings (e.g. `vad`, `interrupts`, `contextCompression`)

**Returns:** Promise that resolves when configuration is updated

**Throws:** Error if not connected or update fails

---

**`async resumeSession(handle: string): Promise<void>`**

Resumes a previous session using a session handle.

**Parameters:**

- `handle: string` - Session handle from previous session

**Returns:** Promise that resolves when session is resumed

**Note:** Session resumption is not yet fully implemented for Gemini Live API

---

**`getSessionHandle(): string | undefined`**

Gets the current session handle for resumption.

**Returns:** Session handle string, or undefined if not available

**Note:** Session handles are not yet fully supported by Gemini Live API

### Voice and Model Information

**`async getSpeakers(): Promise<Array<{ voiceId: string; description?: string }>>`**

Gets available speakers/voices.

**Returns:** Promise that resolves to array of available voices with descriptions

---

**`async getListener(): Promise<{ enabled: boolean }>`**

Checks if listening capabilities are enabled.

**Returns:** Promise that resolves to listening status

**Note:** Inherits default implementation from MastraVoice base class

### Event Handling

**`on<E extends VoiceEventType>(event: E, callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void): void`**

Registers an event listener.

**Parameters:**

- `event: E` - Event name to listen for
- `callback: (data) => void` - Function to call when event occurs

**Available Events:**

- `'speaking'` - Audio response from model
- `'speaker'` - Readable stream of concatenated audio for the active response
- `'writing'` - Text response or transcription
- `'error'` - Error events
- `'session'` - Session state changes
- `'toolCall'` - Tool calls from model
- `'vad'` - Voice activity detection events
- `'interrupt'` - Interrupt events
- `'usage'` - Token usage information
- `'sessionHandle'` - Session resumption handle
- `'turnComplete'` - Turn completion for the current model response

### Tools

Add tools with `addTools()` using either `@mastra/core/tools` or a plain object matching `ToolsInput`.

Using `createTool`:

```ts
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const searchTool = createTool({
  id: 'search',
  description: 'Search the web',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ context }) => {
    const { query } = context;
    // ... perform search
    return { results: [] };
  },
});

voice.addTools({ search: searchTool });
```

Using a plain object (ensure each tool has an `id`):

```ts
voice.addTools({
  search: {
    id: 'search',
    description: 'Search the web',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } } },
    execute: async ({ context }) => ({ results: [] }),
  },
});
```

Tool call events from the model are emitted as:

```ts
voice.on('toolCall', ({ name, args, id }) => {
  // name: string, args: Record<string, any>, id: string
});
```

---

**`off<E extends VoiceEventType>(event: E, callback: (data: E extends keyof GeminiLiveEventMap ? GeminiLiveEventMap[E] : unknown) => void): void`**

Removes an event listener.

**Parameters:**

- `event: E` - Event name to stop listening to
- `callback: (data) => void` - Specific callback function to remove

### Configuration Types

**`GeminiLiveVoiceConfig`**

```typescript
interface GeminiLiveVoiceConfig {
  apiKey?: string;
  model?: GeminiVoiceModel;
  speaker?: GeminiVoiceName;
  vertexAI?: boolean;
  project?: string;
  location?: string;
  serviceAccountKeyFile?: string;
  serviceAccountEmail?: string;
  instructions?: string;
  tools?: GeminiToolConfig[];
  sessionConfig?: GeminiSessionConfig;
  audioConfig?: Partial<AudioConfig>;
  debug?: boolean;
}
```

**`GeminiLiveVoiceOptions`**

```typescript
interface GeminiLiveVoiceOptions {
  speaker?: GeminiVoiceName;
  languageCode?: string;
  responseModalities?: ('AUDIO' | 'TEXT')[];
}
```

**`GeminiSessionConfig`**

```typescript
interface GeminiSessionConfig {
  enableResumption?: boolean;
  maxDuration?: string;
  contextCompression?: boolean;
  vad?: {
    enabled?: boolean;
    sensitivity?: number;
    silenceDurationMs?: number;
  };
  interrupts?: {
    enabled?: boolean;
    allowUserInterruption?: boolean;
  };
}
```

## Features

- **Real-time bidirectional audio streaming**
- **Multimodal input support** (audio, video, text)
- **Built-in Voice Activity Detection (VAD)**
- **Interrupt handling** - Natural conversation flow
- **Session management** - Resume conversations after network interruptions
- **Tool calling support** - Integrate with external APIs and functions
- **Live transcription** - Real-time speech-to-text
- **Multiple voice options** - Choose from various voice personalities
- **Multilingual support** - Support for 30+ languages

## Voice Options

- **Puck** - Conversational, friendly
- **Charon** - Deep, authoritative
- **Kore** - Neutral, professional
- **Fenrir** - Warm, approachable

## Model Options

- `gemini-2.0-flash-exp` - Default model
- `gemini-2.0-flash-live-001` - Latest production model
- `gemini-2.5-flash-preview-native-audio-dialog` - Preview with native audio
- `gemini-live-2.5-flash-preview` - Half-cascade architecture

For detailed API documentation, visit [Google's Gemini Live API docs](https://ai.google.dev/gemini-api/docs/live).
