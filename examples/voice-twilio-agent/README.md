# Twilio Voice Agent Example

Build AI voice agents that handle phone calls using Twilio Media Streams and OpenAI Realtime API.

## Overview

This example demonstrates how to:

- Handle incoming phone calls via Twilio
- Stream audio bidirectionally using WebSockets
- Process speech with OpenAI Realtime API
- Send AI-generated responses back to the caller

## Architecture

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│   Caller    │◄───────►│    Twilio    │◄───────►│   Your Server   │
│  (Phone)    │  PSTN   │    Cloud     │ WebSocket│  (This Example) │
└─────────────┘         └──────────────┘         └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │  OpenAI Realtime│
                                                 │       API       │
                                                 └─────────────────┘
```

**Flow:**

1. Caller dials your Twilio phone number
2. Twilio sends HTTP request to `/incoming-call` webhook
3. Server responds with TwiML to connect Media Stream
4. Twilio opens WebSocket to `/media-stream`
5. Audio streams bidirectionally (mulaw ↔ PCM conversion handled automatically)
6. OpenAI Realtime processes speech and generates responses

## Setup

### 1. Environment Variables

Create a `.env` file:

```bash
# Required
OPENAI_API_KEY=sk-...

# Optional (for production)
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
PUBLIC_URL=your-domain.com
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Start the Server

```bash
pnpm dev
```

### 4. Expose to Internet

For Twilio to reach your server, you need a public URL. Options:

**Option A: LocalTunnel (included)**

```bash
pnpm dev:tunnel
```

**Option B: ngrok**

```bash
ngrok http 3000
```

### 5. Configure Twilio

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Select your phone number
4. Under "Voice Configuration":
   - Set "A call comes in" webhook to: `https://your-url/incoming-call`
   - Method: POST

### 6. Make a Call!

Call your Twilio phone number and start talking to your AI agent.

## Customization

### Modify the Agent

Edit `src/mastra/agents/index.ts` to customize the AI agent:

```typescript
export const phoneAgent = new Agent({
  id: 'phone-agent',
  name: 'Phone Agent',
  instructions: `Your custom instructions here...`,
  model: openai('gpt-4o'),
});
```

### Add Tools

```typescript
import { createTool } from '@mastra/core/tools';

const weatherTool = createTool({
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ context }) => {
    // Your implementation
    return { temperature: 72, conditions: 'sunny' };
  },
});

export const phoneAgent = new Agent({
  // ...
  tools: { weatherTool },
});
```

## API Endpoints

| Endpoint         | Method    | Description                       |
| ---------------- | --------- | --------------------------------- |
| `/`              | GET       | Health check                      |
| `/incoming-call` | POST      | Twilio webhook for incoming calls |
| `/media-stream`  | WebSocket | Twilio Media Streams connection   |

## Audio Format

- **Twilio** sends/receives: μ-law (mulaw), 8kHz, mono
- **OpenAI Realtime** uses: 16-bit PCM, 24kHz

The `@mastra/voice-twilio` package handles all format conversion automatically.

## Troubleshooting

### No audio from AI

- Check that `OPENAI_API_KEY` is set
- Verify OpenAI Realtime connection in logs
- Ensure your OpenAI account has access to Realtime API

### Twilio not connecting

- Verify webhook URL is publicly accessible
- Check Twilio Console for error logs
- Ensure TwiML response is valid XML

### Audio quality issues

- μ-law is telephony-grade (8kHz) - some quality loss is expected
- Check network latency between your server and Twilio/OpenAI

## Related

- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/media-streams)
- [OpenAI Realtime API Documentation](https://platform.openai.com/docs/guides/realtime)
- [Mastra Voice Documentation](https://mastra.ai/docs/voice)
