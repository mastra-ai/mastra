# Telephony Module

The telephony module provides utilities for building AI-powered phone call applications with Mastra. It handles the complexities of audio format conversion, turn-taking, and orchestrating between telephony providers (like Twilio) and AI voice providers (like OpenAI Realtime).

## Installation

The telephony module is included in `@mastra/core`:

```bash
pnpm add @mastra/core
```

## Overview

Building phone-based AI agents involves two distinct concerns:

1. **Telephony** - Connecting to phone networks (PSTN), handling call lifecycle, audio streaming
2. **AI Voice** - Speech-to-speech AI processing, understanding, generating responses

This module provides:

- **`TelephonySession`** - Orchestrates the connection between telephony and AI providers
- **Audio Codecs** - Convert between telephony formats (μ-law) and AI formats (PCM)

## Quick Start

```typescript
import { TelephonySession } from '@mastra/core/voice';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

// 1. Create your AI agent
const agent = new Agent({
  name: 'Phone Support Agent',
  model: openai('gpt-4o'),
  instructions: `You are a helpful phone support agent. 
    Be concise - phone conversations should be natural and brief.
    Ask clarifying questions when needed.`,
});

// 2. Create your voice providers
// - telephonyProvider: Your MastraVoice implementation for the phone network
// - aiProvider: A realtime AI voice provider like OpenAI Realtime
const telephonyProvider = createMyTelephonyProvider(websocket);
const aiProvider = new OpenAIRealtimeVoice({ model: 'gpt-4o-realtime' });

// 3. Create and start the session
const session = new TelephonySession({
  telephony: telephonyProvider,
  ai: aiProvider,
  agent: agent,
  bargeIn: true, // Allow user to interrupt AI
});

// 4. Handle events
session.on('ready', ({ callSid }) => {
  console.log(`Call connected: ${callSid}`);
});

session.on('user:speaking', () => {
  console.log('User is speaking...');
});

session.on('agent:speaking', () => {
  console.log('Agent is responding...');
});

session.on('barge-in', () => {
  console.log('User interrupted the agent');
});

session.on('ended', ({ reason }) => {
  console.log(`Call ended: ${reason}`);
});

// 5. Start the session
await session.start();
```

## TelephonySession

The `TelephonySession` class orchestrates the connection between your telephony provider and AI voice provider.

### Configuration

```typescript
interface TelephonySessionConfig {
  // Required: Voice providers
  telephony: MastraVoice; // Telephony provider (e.g., Twilio)
  ai: MastraVoice; // AI voice provider (e.g., OpenAI Realtime)

  // Optional: Agent integration
  agent?: Agent; // Mastra agent for tools and instructions

  // Optional: Behavior
  codec?: 'mulaw' | 'alaw' | 'pcm'; // Audio codec (default: 'mulaw')
  bargeIn?: boolean; // Allow interrupting AI (default: true)
  speechThreshold?: number; // Energy threshold for speech detection (default: 0.01)
  debug?: boolean; // Enable debug logging (default: false)
}
```

### Events

| Event            | Payload                    | Description                 |
| ---------------- | -------------------------- | --------------------------- |
| `ready`          | `{ callSid?, streamSid? }` | Session connected and ready |
| `ended`          | `{ reason: string }`       | Session ended               |
| `user:speaking`  | `void`                     | User started speaking       |
| `user:stopped`   | `{ transcript?: string }`  | User stopped speaking       |
| `agent:speaking` | `void`                     | Agent started speaking      |
| `agent:stopped`  | `void`                     | Agent stopped speaking      |
| `barge-in`       | `void`                     | User interrupted the agent  |
| `error`          | `Error`                    | An error occurred           |

### Methods

```typescript
// Start the session
await session.start();

// End the session
session.end('reason');

// Get current state
session.getState(); // 'idle' | 'connecting' | 'active' | 'ended'

// Get who's currently speaking
session.getSpeaker(); // 'none' | 'user' | 'agent'
```

## Audio Codecs

Phone networks use compressed audio formats that differ from what AI providers expect. This module provides conversion utilities.

### Why Audio Conversion?

- **Phone networks** use **μ-law (mulaw)** or **A-law** encoding
  - 8-bit compressed audio at 8kHz
  - Optimized for voice over limited bandwidth
- **AI providers** typically use **PCM**
  - 16-bit linear audio at 16kHz+
  - Higher fidelity for AI processing

### Available Functions

```typescript
import { mulawToPcm, pcmToMulaw, alawToPcm, pcmToAlaw, convertAudio } from '@mastra/core/voice';

// μ-law (North America, Japan)
const pcmAudio = mulawToPcm(mulawBuffer); // Buffer → Int16Array
const mulawAudio = pcmToMulaw(pcmInt16); // Int16Array → Buffer

// A-law (Europe, International)
const pcmAudio = alawToPcm(alawBuffer); // Buffer → Int16Array
const alawAudio = pcmToAlaw(pcmInt16); // Int16Array → Buffer

// Generic conversion
const converted = convertAudio(audio, 'mulaw', 'pcm');
```

### Usage Example

```typescript
// Receiving audio from phone (Twilio sends mulaw)
twilioVoice.on('audio-received', (mulawBuffer: Buffer) => {
  const pcmAudio = mulawToPcm(mulawBuffer);
  aiVoice.send(pcmAudio);
});

// Sending audio to phone (Twilio expects mulaw)
aiVoice.on('audio', (pcmAudio: Int16Array) => {
  const mulawBuffer = pcmToMulaw(pcmAudio);
  twilioVoice.sendRaw(streamSid, mulawBuffer);
});
```

## Building a Telephony Provider

To integrate with a telephony service (Twilio, Vonage, Telnyx, etc.), create a class that extends `MastraVoice`:

```typescript
import { MastraVoice, mulawToPcm, pcmToMulaw } from '@mastra/core/voice';

export class MyTelephonyVoice extends MastraVoice {
  constructor(config: MyConfig) {
    super({ name: 'my-telephony' });
    // Setup...
  }

  // Handle incoming WebSocket messages from your provider
  handleMessage(message: string | Buffer): void {
    const data = JSON.parse(message.toString());

    if (data.type === 'audio') {
      // Convert to PCM and emit for TelephonySession
      const pcm = mulawToPcm(Buffer.from(data.payload, 'base64'));
      this.emit('audio-received', pcm);
    }

    if (data.type === 'call-start') {
      this.emit('call-started', { callSid: data.callSid });
    }
  }

  // Send audio back to the phone
  sendAudio(streamId: string, pcmAudio: Int16Array): void {
    const mulaw = pcmToMulaw(pcmAudio);
    const payload = mulaw.toString('base64');

    this.ws.send(
      JSON.stringify({
        type: 'audio',
        streamId,
        payload,
      }),
    );
  }

  // Required MastraVoice methods
  async speak(input: string | NodeJS.ReadableStream): Promise<void> {
    // TTS handled by AI provider in TelephonySession
  }

  async listen(audio: NodeJS.ReadableStream): Promise<string> {
    // STT handled by AI provider in TelephonySession
    return '';
  }

  // Event handling
  on(event: string, callback: Function): void {
    /* ... */
  }
  off(event: string, callback: Function): void {
    /* ... */
  }
  close(): void {
    /* ... */
  }
}
```

### Required Events

Your telephony provider should emit these events for `TelephonySession`:

| Event            | Payload                    | When                       |
| ---------------- | -------------------------- | -------------------------- |
| `call-started`   | `{ callSid?, streamSid? }` | Call connected             |
| `audio-received` | `Int16Array`               | Audio received from caller |
| `call-ended`     | `{ callSid? }`             | Call disconnected          |
| `error`          | `Error`                    | Error occurred             |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phone Call                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Telephony Provider (e.g., Twilio)                   │
│                                                                  │
│  - WebSocket connection to phone network                        │
│  - Audio in μ-law/A-law format                                  │
│  - Call lifecycle management                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     TelephonySession                             │
│                                                                  │
│  - Audio format conversion (μ-law ↔ PCM)                        │
│  - Routes audio between telephony ↔ AI                          │
│  - Turn-taking detection                                         │
│  - Barge-in handling (user interrupts AI)                       │
│  - Agent tools/instructions integration                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│               AI Voice Provider (e.g., OpenAI Realtime)          │
│                                                                  │
│  - Speech-to-speech processing                                   │
│  - Tool calling                                                  │
│  - Natural language understanding                                │
└─────────────────────────────────────────────────────────────────┘
```

## Turn-Taking & Barge-In

### Turn-Taking

The session tracks who is currently speaking:

```typescript
session.on('user:speaking', () => {
  // User started talking
  // AI should listen
});

session.on('user:stopped', ({ transcript }) => {
  // User finished talking
  // AI will respond
  console.log('User said:', transcript);
});

session.on('agent:speaking', () => {
  // AI is responding
});

session.on('agent:stopped', () => {
  // AI finished responding
  // Ready for next user input
});
```

### Barge-In

Barge-in allows users to interrupt the AI mid-sentence, creating more natural conversations:

```typescript
const session = new TelephonySession({
  telephony,
  ai,
  bargeIn: true, // Enable barge-in
  speechThreshold: 0.01, // Sensitivity (0-1)
});

session.on('barge-in', () => {
  // User interrupted the AI
  // AI response is cut off
  // Session switches to listening mode
});
```

## Integration with Mastra Agents

When you provide an `agent` to `TelephonySession`, it automatically:

1. **Adds tools** - Makes agent tools available for the AI voice to call
2. **Adds instructions** - Provides the agent's system prompt to guide responses

```typescript
const agent = new Agent({
  name: 'Support Agent',
  model: openai('gpt-4o'),
  instructions: 'You help customers with their orders.',
  tools: {
    lookupOrder: createTool({
      description: 'Look up an order by ID',
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        // ... lookup logic
        return { status: 'shipped', eta: '2 days' };
      },
    }),
  },
});

const session = new TelephonySession({
  telephony,
  ai,
  agent, // Tools and instructions are automatically added
});
```

## Error Handling

```typescript
session.on('error', (error: Error) => {
  console.error('Session error:', error);

  // Optionally end the session
  session.end('error');
});

// Handle disconnections gracefully
session.on('ended', ({ reason }) => {
  if (reason === 'error') {
    // Log for debugging
  }

  // Cleanup resources
});
```

## Best Practices

### 1. Keep Responses Concise

Phone conversations should be natural and brief:

```typescript
const agent = new Agent({
  instructions: `You are a phone support agent.
    - Keep responses under 2-3 sentences
    - Ask one question at a time
    - Confirm understanding before proceeding`,
});
```

### 2. Handle Silence

Consider what happens during pauses:

```typescript
session.on('user:stopped', ({ transcript }) => {
  if (!transcript || transcript.trim() === '') {
    // User was silent - maybe prompt them
  }
});
```

### 3. Graceful Disconnection

Always handle session end:

```typescript
session.on('ended', ({ reason }) => {
  // Cleanup
  // Log analytics
  // Update call records
});

// End gracefully when done
session.end('completed');
```

### 4. Debug During Development

```typescript
const session = new TelephonySession({
  telephony,
  ai,
  debug: true, // Logs detailed info
});
```

## Supported Providers

### Telephony Providers (Build Your Own)

Use this module's utilities to build integrations with:

- Twilio Media Streams
- Vonage
- Telnyx
- Bandwidth
- SignalWire
- Any WebSocket-based telephony API

### AI Voice Providers

Works with Mastra's realtime voice providers:

- OpenAI Realtime (`@mastra/voice-openai-realtime`)
- Google Gemini Live (`@mastra/voice-google-gemini-live`)

## API Reference

### TelephonySession

```typescript
class TelephonySession {
  constructor(config: TelephonySessionConfig);

  start(): Promise<void>;
  end(reason?: string): void;

  getState(): 'idle' | 'connecting' | 'active' | 'ended';
  getSpeaker(): 'none' | 'user' | 'agent';

  on<K extends keyof TelephonySessionEvents>(event: K, callback: (data: TelephonySessionEvents[K]) => void): void;

  off<K extends keyof TelephonySessionEvents>(event: K, callback: (data: TelephonySessionEvents[K]) => void): void;
}
```

### Audio Codecs

```typescript
// μ-law (mulaw) - North America, Japan
function mulawToPcm(mulaw: Buffer): Int16Array;
function pcmToMulaw(pcm: Int16Array): Buffer;

// A-law - Europe, International
function alawToPcm(alaw: Buffer): Int16Array;
function pcmToAlaw(pcm: Int16Array): Buffer;

// Generic
function convertAudio(
  audio: Buffer | Int16Array,
  fromCodec: 'mulaw' | 'alaw' | 'pcm',
  toCodec: 'mulaw' | 'alaw' | 'pcm',
): Buffer | Int16Array;
```
