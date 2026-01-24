# @mastra/voice-twilio

Twilio Voice integration for Mastra, enabling AI-powered phone conversations using Twilio Media Streams.

## Installation

```bash
pnpm add @mastra/voice-twilio
```

## Quick Start

```typescript
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { WebSocketServer } from 'ws';
import { Agent } from '@mastra/core/agent';
import { TelephonySession, CompositeVoice } from '@mastra/core/voice';
import { TwilioVoice, generateTwiML } from '@mastra/voice-twilio';
import { OpenAIRealtimeVoice } from '@mastra/voice-openai-realtime';
import { openai } from '@ai-sdk/openai';

const app = new Hono();

// Create a voice-enabled agent
const agent = new Agent({
  name: 'Phone Agent',
  model: openai('gpt-4o'),
  instructions: 'You are a helpful phone assistant. Keep responses brief.',
  voice: new CompositeVoice({
    realtime: new OpenAIRealtimeVoice({
      model: 'gpt-4o-realtime-preview',
      apiKey: process.env.OPENAI_API_KEY,
    }),
  }),
});

// Twilio webhook - called when a call comes in
app.post('/incoming-call', c => {
  const twiml = generateTwiML({
    url: `wss://${c.req.header('host')}/media-stream`,
  });
  return c.text(twiml, 200, { 'Content-Type': 'text/xml' });
});

// Start server
const server = serve({ fetch: app.fetch, port: 3000 });

// WebSocket server for Twilio Media Streams
const wss = new WebSocketServer({ server, path: '/media-stream' });

wss.on('connection', async ws => {
  const twilioVoice = new TwilioVoice();

  const session = new TelephonySession({
    agent,
    telephony: twilioVoice,
    bargeIn: true,
  });

  // Connect Twilio WebSocket to the voice provider
  twilioVoice.connect(ws);

  session.on('ready', ({ callSid }) => {
    console.log(`Call connected: ${callSid}`);
  });

  session.on('ended', ({ reason }) => {
    console.log(`Call ended: ${reason}`);
  });

  await session.start();
});
```

## TwilioVoice

The `TwilioVoice` class handles the Twilio Media Streams WebSocket protocol.

### Methods

```typescript
// Connect to Twilio WebSocket
twilioVoice.connect(ws: WebSocket);

// Send PCM audio to caller (auto-converts to μ-law)
twilioVoice.sendAudio(audio: Int16Array);

// Send a mark for synchronization
twilioVoice.sendMark(name: string);

// Clear audio playback queue (for barge-in)
twilioVoice.clearAudio();

// Get call/stream identifiers
twilioVoice.getCallSid();
twilioVoice.getStreamSid();

// Close the connection
twilioVoice.close();
```

### Events

| Event            | Payload                            | Description                       |
| ---------------- | ---------------------------------- | --------------------------------- |
| `call-started`   | `{ callSid, streamSid }`           | Call connected and stream started |
| `audio-received` | `{ audio: Int16Array, streamSid }` | Audio received from caller (PCM)  |
| `call-ended`     | `{ callSid }`                      | Call ended                        |
| `mark`           | `{ name }`                         | Mark event received               |
| `error`          | `Error`                            | Error occurred                    |

## TwiML Helpers

Generate TwiML for Twilio webhooks:

### Simple Stream

```typescript
import { generateTwiML } from '@mastra/voice-twilio';

const twiml = generateTwiML({
  url: 'wss://example.com/media-stream',
  parameters: { agentId: 'support-agent' },
});
```

### TwiML Builder

For more complex scenarios:

```typescript
import { twiml } from '@mastra/voice-twilio';

// Simple responses
const sayTwiml = twiml.say({ text: 'Hello!' });
const rejectTwiml = twiml.reject('busy');
const hangupTwiml = twiml.hangup();

// Complex response with builder
const response = twiml
  .response()
  .say({ text: 'Please wait while we connect you.' })
  .pause(1)
  .stream({ url: 'wss://example.com/media-stream' })
  .build();
```

## Architecture

```
Phone Call → Twilio → WebSocket → TwilioVoice → TelephonySession → Agent.voice
                                       ↓                              ↓
                                  μ-law audio                  CompositeVoice
                                       ↓                              ↓
                                  mulawToPcm()               OpenAIRealtimeVoice
                                       ↓                              ↓
                                  PCM Int16Array              AI processes speech
                                                                      ↓
                                                              generates response
                                                                      ↓
                                                              pcmToMulaw()
                                                                      ↓
Phone Call ← Twilio ← WebSocket ← TwilioVoice ← TelephonySession ←───┘
```

## Setup with Twilio

1. Get a Twilio phone number
2. Expose your server publicly (ngrok for development)
3. Configure your Twilio phone number webhook to point to `/incoming-call`

```bash
# Development with ngrok
ngrok http 3000
# Then set webhook URL to: https://your-ngrok-url.ngrok.io/incoming-call
```

## Integration with TelephonySession

`TwilioVoice` is designed to work with `TelephonySession` from `@mastra/core/voice`:

- **Audio conversion** is handled automatically (μ-law ↔ PCM)
- **Turn-taking** and **barge-in** are managed by `TelephonySession`
- **Agent tools and instructions** are automatically configured via the agent's voice

```typescript
// The agent owns the voice configuration
const agent = new Agent({
  name: 'Support',
  model: openai('gpt-4o'),
  instructions: '...',
  tools: { ... },
  voice: new CompositeVoice({
    realtime: new OpenAIRealtimeVoice(),
  }),
});

// TelephonySession connects Twilio to the agent's voice
const session = new TelephonySession({
  agent,              // Voice, tools, and instructions from agent
  telephony: twilioVoice,
  bargeIn: true,
});
```

## License

Apache-2.0
