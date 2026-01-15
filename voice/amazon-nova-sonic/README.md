# @mastra/voice-amazon-nova-sonic

Amazon Nova Sonic voice provider for Mastra, enabling real-time speech-to-speech conversations using AWS Bedrock.

## Installation

```bash
pnpm add @mastra/voice-amazon-nova-sonic
```

## Features

- **Real-time Bidirectional Audio Streaming** - Low-latency speech-to-speech using AWS Bedrock's bidirectional streaming API
- **Multiple Voice Options** - Support for Tiffany, Amy, Matthew, and Ruth voices
- **Speech-to-Text** - Automatic transcription of user audio input
- **Text-to-Speech** - Convert text responses to natural speech
- **Tool Calling** - Execute tools during voice conversations
- **Event-based Architecture** - React to audio, transcription, and session events

## Quick Start

```typescript
import { NovaSonicVoice } from '@mastra/voice-amazon-nova-sonic';

const voice = new NovaSonicVoice({
  region: 'us-east-1',
  speaker: 'tiffany',
  instructions: 'You are a helpful voice assistant.',
});

// Connect to AWS Bedrock
await voice.connect();

// Listen for events
voice.on('speaking', ({ audio, audioData, sampleRate }) => {
  // Handle audio output (PCM16 format)
  playAudio(audioData, sampleRate);
});

voice.on('writing', ({ text, role }) => {
  console.log(`${role}: ${text}`);
});

// Send text for speech
await voice.speak('Hello! How can I help you today?');

// Or stream audio for speech-to-text
await voice.send(microphoneStream);

// Disconnect when done
voice.disconnect();
```

## Configuration

```typescript
interface NovaSonicVoiceConfig {
  // AWS Configuration
  region?: string; // AWS region (default: 'us-east-1')
  accessKeyId?: string; // AWS access key (or use env: AWS_ACCESS_KEY_ID)
  secretAccessKey?: string; // AWS secret key (or use env: AWS_SECRET_ACCESS_KEY)
  sessionToken?: string; // AWS session token (for temporary credentials)

  // Model Configuration
  model?: string; // Model ID (default: 'amazon.nova-sonic-v1:0')
  speaker?: NovaSonicVoiceId; // Voice ID (default: 'tiffany')
  instructions?: string; // System prompt for the voice assistant

  // Audio Configuration
  audioConfig?: {
    inputSampleRate?: number; // Input sample rate (default: 16000)
    outputSampleRate?: number; // Output sample rate (default: 24000)
    inputFormat?: 'pcm'; // Input format (PCM16)
    outputFormat?: 'pcm'; // Output format (PCM16)
  };

  // Development
  debug?: boolean; // Enable debug logging
}
```

## Available Voices

| Voice ID  | Description                                   |
| --------- | --------------------------------------------- |
| `tiffany` | Default female voice - clear and professional |
| `amy`     | Female voice - warm and conversational        |
| `matthew` | Male voice - confident and articulate         |
| `ruth`    | Female voice - friendly and approachable      |

## Events

| Event              | Payload                            | Description                         |
| ------------------ | ---------------------------------- | ----------------------------------- |
| `speaking`         | `{ audio, audioData, sampleRate }` | Audio output from the model         |
| `writing`          | `{ text, role }`                   | Text transcript (user or assistant) |
| `speaker`          | `PassThrough`                      | Stream for audio playback           |
| `session`          | `{ state }`                        | Connection state changes            |
| `toolCall`         | `{ name, args, id }`               | Tool invocation request             |
| `tool-call-start`  | `{ toolCallId, toolName, args }`   | Tool execution started              |
| `tool-call-result` | `{ toolCallId, toolName, result }` | Tool execution completed            |
| `turnComplete`     | `{ timestamp }`                    | Model turn completed                |
| `error`            | `{ message, code, details }`       | Error occurred                      |

## Methods

### Connection

```typescript
// Connect to Nova Sonic
await voice.connect();

// Check connection status
voice.isConnected(); // boolean
voice.getConnectionState(); // 'disconnected' | 'connecting' | 'connected'

// Disconnect
voice.disconnect();
// or
voice.close();
```

### Speech

```typescript
// Text-to-speech
await voice.speak('Hello, world!');

// Stream text for TTS
await voice.speak(textStream);

// Send audio for speech-to-text
await voice.send(audioStream);          // NodeJS.ReadableStream
await voice.send(new Int16Array([...])); // PCM16 audio data

// Get transcription from audio
const text = await voice.listen(audioStream);
```

### Configuration

```typescript
// Add system instructions
voice.addInstructions('You are a helpful assistant.');

// Add tools for function calling
voice.addTools({
  getWeather: {
    id: 'getWeather',
    description: 'Get current weather',
    inputSchema: {
      type: 'object',
      properties: { location: { type: 'string' } },
    },
    execute: async ({ context }) => {
      return { temperature: 72, condition: 'sunny' };
    },
  },
});

// Update configuration at runtime
voice.updateConfig({ speaker: 'amy' });
```

## With Mastra Agent

```typescript
import { Agent } from '@mastra/core/agent';
import { NovaSonicVoice } from '@mastra/voice-amazon-nova-sonic';

const voice = new NovaSonicVoice({
  speaker: 'matthew',
  instructions: 'You are a customer service agent.',
});

const agent = new Agent({
  name: 'Support Agent',
  voice: voice,
  tools: {
    lookupOrder: { ... },
    createTicket: { ... },
  },
});

// Connect and use the agent's voice capabilities
await agent.voice.connect();
```

## Audio Format

Nova Sonic uses PCM16 (16-bit signed integer) audio format:

- **Input**: 16kHz sample rate (configurable)
- **Output**: 24kHz sample rate (configurable)
- **Channels**: Mono

### Converting Audio

```typescript
// From Web Audio API
const audioContext = new AudioContext({ sampleRate: 16000 });
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const source = audioContext.createMediaStreamSource(mediaStream);
// ... process and send to voice.send()

// From Node.js
import { createReadStream } from 'fs';
const audioStream = createReadStream('input.pcm');
await voice.send(audioStream);
```

## AWS Credentials

The provider uses the AWS SDK credential chain. You can provide credentials in several ways:

1. **Explicit configuration**:

   ```typescript
   new NovaSonicVoice({
     accessKeyId: 'AKIA...',
     secretAccessKey: '...',
   });
   ```

2. **Environment variables**:

   ```bash
   export AWS_ACCESS_KEY_ID=AKIA...
   export AWS_SECRET_ACCESS_KEY=...
   export AWS_REGION=us-east-1
   ```

3. **IAM roles** (recommended for production):
   - EC2 instance roles
   - ECS task roles
   - Lambda execution roles

## IAM Permissions

Required permissions for the IAM user/role:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "bedrock:InvokeModelWithBidirectionalStream",
      "Resource": "arn:aws:bedrock:*:*:model/amazon.nova-sonic-v1:0"
    }
  ]
}
```

## Error Handling

```typescript
voice.on('error', ({ message, code, details }) => {
  console.error(`Error [${code}]: ${message}`, details);
});

try {
  await voice.connect();
} catch (error) {
  console.error('Connection failed:', error);
}
```

## Requirements

- Node.js >= 22.13.0
- AWS account with Bedrock access
- Nova Sonic model enabled in your AWS region

## Related

- [Amazon Nova Documentation](https://docs.aws.amazon.com/nova/latest/userguide/speech.html)
- [Mastra Voice Documentation](https://mastra.ai/docs/agents/adding-voice)
- [AWS Bedrock Runtime SDK](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/client/bedrock-runtime/)

## License

Apache-2.0
