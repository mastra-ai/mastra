# Telephony Module

The telephony module provides utilities for building AI-powered phone call applications with Mastra. It handles the complexities of audio format conversion, turn-taking, and orchestrating between telephony providers (like Twilio) and voice-enabled agents.

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

- **`TelephonySession`** - Orchestrates the connection between telephony providers and voice-enabled agents
- **Audio Codecs** - Convert between telephony formats (μ-law, A-law) and AI formats (PCM) using the [`alawmulaw`](https://www.npmjs.com/package/alawmulaw) library

## Quick Start

```typescript
import { Agent } from '@mastra/core/agent';
import { TelephonySession, CompositeVoice } from '@mastra/core/voice';
import { openai } from '@ai-sdk/openai';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { TwilioVoice } from '@mastra/voice-twilio';

// 1. Create a voice-enabled agent
const agent = new Agent({
  name: 'Phone Support Agent',
  model: openai('gpt-4o'),
  instructions: `You are a helpful phone support agent. 
    Be concise - phone conversations should be natural and brief.
    Ask clarifying questions when needed.`,
  voice: new CompositeVoice({
    realtime: new OpenAIRealtimeVoice({
      model: 'gpt-4o-realtime-preview',
    }),
  }),
});

// 2. Create the telephony session
const session = new TelephonySession({
  agent,
  telephony: new TwilioVoice(),
  bargeIn: true, // Allow user to interrupt AI
});

// 3. Handle events
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

// 4. Start the session (in your WebSocket handler)
await session.start();
```

## TelephonySession

The `TelephonySession` class orchestrates the connection between your telephony provider and the agent's voice.

### Configuration

```typescript
interface TelephonySessionConfig {
  // Required
  agent: Agent; // Voice-enabled agent (must have voice configured)
  telephony: MastraVoice; // Telephony provider (e.g., TwilioVoice)

  // Optional
  codec?: 'mulaw' | 'alaw' | 'pcm'; // Audio codec (default: 'mulaw')
  bargeIn?: boolean; // Allow interrupting AI (default: true)
  speechThreshold?: number; // Energy threshold for speech detection (default: 0.01)
  name?: string; // Session name for logging
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

// Get the agent
session.getAgent();
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

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Phone Call                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Telephony Provider (e.g., TwilioVoice)              │
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
│  - Routes audio between telephony ↔ agent.voice                 │
│  - Turn-taking detection                                         │
│  - Barge-in handling (user interrupts AI)                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent with Voice                              │
│                                                                  │
│  - agent.voice (CompositeVoice with realtime provider)          │
│  - Tools and instructions automatically configured               │
│  - Speech-to-speech processing via realtime provider            │
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
  agent,
  telephony,
  bargeIn: true, // Enable barge-in
  speechThreshold: 0.01, // Sensitivity (0-1)
});

session.on('barge-in', () => {
  // User interrupted the AI
  // AI response is cut off
  // Session switches to listening mode
});
```

## Setting Up Your Agent

The agent must have a voice configured with a realtime provider:

```typescript
import { Agent } from '@mastra/core/agent';
import { CompositeVoice } from '@mastra/core/voice';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';

const agent = new Agent({
  name: 'Support Agent',
  model: openai('gpt-4o'),
  instructions: 'You help customers with their orders.',
  tools: {
    lookupOrder: createTool({
      description: 'Look up an order by ID',
      parameters: z.object({ orderId: z.string() }),
      execute: async ({ orderId }) => {
        return { status: 'shipped', eta: '2 days' };
      },
    }),
  },
  // Voice configuration - tools and instructions are automatically added
  voice: new CompositeVoice({
    realtime: new OpenAIRealtimeVoice({
      model: 'gpt-4o-realtime-preview',
    }),
  }),
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
  // ...
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

## Supported Providers

### Telephony Providers

- `@mastra/voice-twilio` - Twilio Media Streams

### AI Voice Providers (for agent.voice)

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
  getAgent(): Agent;

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
