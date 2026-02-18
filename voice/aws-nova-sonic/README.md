# @mastra/voice-aws-nova-sonic

Mastra integration for AWS Nova 2 Sonic, providing real-time bidirectional speech-to-speech capabilities using Amazon Bedrock's bidirectional streaming API.

## Features

- **Real-time bidirectional streaming**: Continuous audio streaming in both directions
- **Multilingual support**: Supports English, French, Italian, German, Spanish, Portuguese, and Hindi
- **Polyglot voices**: Voices that can speak multiple languages within the same session
- **Barge-in support**: Users can interrupt the assistant mid-speech; handled server-side by Nova Sonic
- **Tool/function calling**: Support for agentic workflows and async tool execution
- **Cross-modal input**: Support for both audio and text inputs in the same conversation
- **Natural turn-taking**: Intelligent voice activity detection and turn management
- **Robust error handling**: Comprehensive error handling with detailed error codes

## Installation

```bash
npm install @mastra/voice-aws-nova-sonic
# or
pnpm add @mastra/voice-aws-nova-sonic
# or
yarn add @mastra/voice-aws-nova-sonic
```

## Prerequisites

- Node.js >= 22.13.0
- AWS account with access to Amazon Bedrock
- AWS credentials configured (see [AWS Setup](#aws-setup))
- Access to Nova 2 Sonic model in your AWS region

## AWS Setup

### 1. Enable Nova 2 Sonic in Amazon Bedrock

1. Go to the [Amazon Bedrock Console](https://console.aws.amazon.com/bedrock/)
2. Navigate to "Model access" in the left sidebar
3. Request access to "Amazon Nova 2 Sonic" model
4. Wait for approval (usually instant)

### 2. Configure AWS Credentials

You can configure AWS credentials in several ways:

**Option 1: Environment Variables**
```bash
export AWS_ACCESS_KEY_ID=your-access-key-id
export AWS_SECRET_ACCESS_KEY=your-secret-access-key
export AWS_REGION=us-east-1
```

**Option 2: AWS Credentials File**
```ini
# ~/.aws/credentials
[default]
aws_access_key_id = your-access-key-id
aws_secret_access_key = your-secret-access-key
```

**Option 3: IAM Role** (for EC2/Lambda)
- Attach an IAM role with Bedrock permissions to your EC2 instance or Lambda function

**Option 4: Explicit Credentials in Code**
```typescript
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

const voice = new NovaSonicVoice({
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'your-access-key-id',
    secretAccessKey: 'your-secret-access-key',
  },
});
```

### 3. IAM Permissions

Your AWS credentials need the following IAM permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithBidirectionalStream"
      ],
      "Resource": "arn:aws:bedrock:*::foundation-model/amazon.nova-2-sonic-v1:0"
    }
  ]
}
```

## Usage

### Basic Example

```typescript
import { Agent } from '@mastra/core/agent';
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

const agent = new Agent({
  name: 'Nova Sonic Agent',
  instructions: 'You are a helpful assistant with real-time voice capabilities.',
  model: 'openai/gpt-4o',
  voice: new NovaSonicVoice({
    region: 'us-east-1',
    speaker: 'tiffany',
  }),
});

// Connect to the voice service
await agent.voice.connect();

// Listen for agent audio responses (stream of audio data)
agent.voice.on('speaker', (audioStream) => {
  // Pipe to your audio output (e.g., speaker, WebSocket, file)
  audioStream.pipe(yourAudioOutput);
});

// Listen for text transcriptions
agent.voice.on('writing', ({ text, role, generationStage }) => {
  // generationStage is 'SPECULATIVE' (preview) or 'FINAL' (actual transcript)
  console.log(`[${role}] ${text}`);
});

// Send continuous audio from the microphone (NodeJS.ReadableStream of PCM16 audio)
await agent.voice.send(microphoneStream);
```

### Advanced Configuration

```typescript
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';

const voice = new NovaSonicVoice({
  region: 'us-east-1', // or 'us-west-2', 'ap-northeast-1'
  model: 'amazon.nova-2-sonic-v1:0',
  speaker: 'matthew', // or 'tiffany', 'amy', etc.
  languageCode: 'en-US',
  instructions: 'You are a helpful assistant.',
  sessionConfig: {
    tools: [
      {
        name: 'search',
        description: 'Search the web',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    ],
    turnDetectionConfiguration: {
      // HIGH = fastest (1.5s pause), MEDIUM = balanced (1.75s), LOW = slowest (2s)
      endpointingSensitivity: 'MEDIUM',
    },
  },
  debug: true,
});

await voice.connect();
```

### With Tools

```typescript
import { Agent } from '@mastra/core/agent';
import { NovaSonicVoice } from '@mastra/voice-aws-nova-sonic';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const weatherTool = createTool({
  id: 'weather',
  description: 'Get weather information',
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ context }) => {
    // Fetch weather data
    return { temperature: 72, condition: 'sunny' };
  },
});

const agent = new Agent({
  name: 'Weather Agent',
  instructions: 'You help users get weather information.',
  model: 'openai/gpt-4o',
  tools: {
    weather: weatherTool,
  },
  voice: new NovaSonicVoice({
    region: 'us-east-1',
  }),
});

await agent.voice.connect();
// Tools are automatically available to the voice model
```

### Cross-Modal Text Input

Send text messages during an active voice session:

```typescript
// After connecting and starting audio streaming
await agent.voice.speak('What is the weather in New York?');
```

## API Reference

### Constructor

```typescript
new NovaSonicVoice(config?: NovaSonicVoiceConfig)
```

**Configuration Options:**

- `region` (string, optional): AWS region. Default: `'us-east-1'`. Supported: `'us-east-1'`, `'us-west-2'`, `'ap-northeast-1'`
- `model` (string, optional): Model ID. Default: `'amazon.nova-2-sonic-v1:0'`
- `credentials` (Credentials, optional): AWS credentials. If not provided, uses default credential chain
- `speaker` (string, optional): Voice name/identifier (e.g., `'matthew'`, `'tiffany'`, `'amy'`)
- `languageCode` (string, optional): Language code (e.g., `'en-US'`, `'fr-FR'`)
- `instructions` (string, optional): System instructions for the model
- `tools` (array, optional): Tool definitions
- `sessionConfig` (object, optional): Session configuration including `turnDetectionConfiguration`, `tools`, `inferenceConfiguration`
- `debug` (boolean, optional): Enable debug logging. Default: `false`

### Methods

#### `connect(options?)`

Establishes connection to AWS Bedrock. Must be called before using other methods.

```typescript
await voice.connect();
```

#### `speak(input, options?)`

Send cross-modal text input during an active voice session. Nova Sonic processes it and responds with audio.

```typescript
await voice.speak('Hello, world!');
```

#### `listen(audioStream, options?)`

Stream audio input for transcription. For Nova Sonic, this is equivalent to `send()`.

```typescript
await voice.listen(audioStream);
```

#### `send(audioData)`

Stream audio data in real-time. Accepts a `NodeJS.ReadableStream` (PCM16 audio) or an `Int16Array`.

```typescript
// Stream from a ReadableStream
await voice.send(audioStream);

// Or with Int16Array
const audioArray = new Int16Array([...]);
await voice.send(audioArray);
```

#### `close()`

Disconnect and cleanup resources.

```typescript
voice.close();
```

#### `on(event, callback)`

Register an event listener.

```typescript
voice.on('speaking', ({ audio }) => {
  // audio is a base64-encoded string of PCM audio
});

voice.on('writing', ({ text, role, generationStage }) => {
  // generationStage: 'SPECULATIVE' (preview) or 'FINAL' (actual transcript)
  console.log(`${role}: ${text}`);
});

voice.on('error', ({ message, code }) => {
  console.error(`Error: ${message} (${code})`);
});
```

#### `off(event, callback)`

Remove an event listener.

```typescript
voice.off('speaking', callback);
```

### Events

- **`speaker`**: Audio stream (`NodeJS.ReadableStream`) for the full response
- **`speaking`**: Audio chunk `{ audio: string, audioData: Buffer, response_id?: string }`
- **`writing`**: Text transcription `{ text: string, role: 'assistant' | 'user', generationStage?: 'SPECULATIVE' | 'FINAL' }`
- **`error`**: Error event `{ message: string, code?: string, details?: unknown }`
- **`toolCall`**: Tool invocation `{ name: string, args: Record<string, any>, id: string }`
- **`turnComplete`**: Turn completion `{ timestamp: number }`
- **`interrupt`**: Barge-in detected `{ type: string, timestamp: number }`
- **`contentStart`**: Content block started (raw Nova Sonic event)
- **`contentEnd`**: Content block ended (raw Nova Sonic event)
- **`usage`**: Token usage `{ inputTokens: number, outputTokens: number, totalTokens: number }`

## Supported Regions

- `us-east-1` (US East - N. Virginia)
- `us-west-2` (US West - Oregon)
- `ap-northeast-1` (Asia Pacific - Tokyo)

## Supported Languages

- English (US, UK, India, Australia)
- French
- Italian
- German
- Spanish
- Portuguese
- Hindi

## Error Handling

The package provides error handling with specific error codes:

```typescript
import { NovaSonicError, NovaSonicErrorCode } from '@mastra/voice-aws-nova-sonic';

voice.on('error', ({ message, code, details }) => {
  if (code === NovaSonicErrorCode.CONNECTION_FAILED) {
    // Handle connection error
  } else if (code === NovaSonicErrorCode.CREDENTIALS_MISSING) {
    // Handle credentials error
  }
});
```

## Troubleshooting

### Connection Issues

- Verify AWS credentials are configured correctly
- Check that Nova 2 Sonic is enabled in your AWS Bedrock console
- Ensure your IAM role/user has the required permissions
- Verify the region supports Nova 2 Sonic

### Audio Issues

- Ensure audio format is compatible (PCM, 16-bit, 16kHz)
- Check sample rate matches expected format
- Verify audio stream is not empty

### Authentication Issues

- Check AWS credentials are valid
- Verify IAM permissions include Bedrock access
- Ensure region is correct

## License

Apache-2.0

## Links

- [Mastra Documentation](https://mastra.ai)
- [AWS Nova 2 Sonic Documentation](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
