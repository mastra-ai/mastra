# @mastra/voice-xai-realtime

xAI Grok Voice Agent API integration for Mastra. This package provides a realtime `MastraVoice` provider that connects to xAI's WebSocket API for bidirectional text and audio conversations.

## Installation

```bash
npm install @mastra/voice-xai-realtime
```

## Configuration

Set an xAI API key for server-side use:

```bash
XAI_API_KEY=your_xai_api_key
```

This provider is built for Node.js server-side runtimes. If you already mint xAI ephemeral tokens on your server, you can pass one with `ephemeralToken`; the provider sends it through the WebSocket protocol as `xai-client-secret.<token>` instead of sending an authorization header. If both `apiKey` and `ephemeralToken` are configured, the provider uses the ephemeral token.

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { getMicrophoneStream, playAudio } from '@mastra/node-audio';
import { XAIRealtimeVoice } from '@mastra/voice-xai-realtime';

const voice = new XAIRealtimeVoice({
  apiKey: process.env.XAI_API_KEY,
  model: 'grok-voice-think-fast-1.0',
  speaker: 'eve',
  instructions: 'You are a concise voice assistant.',
  turnDetection: { type: 'server_vad' },
});

const agent = new Agent({
  id: 'voice-agent',
  name: 'Voice Agent',
  instructions: 'You are a helpful voice assistant.',
  model: 'xai/grok-4.3',
  voice,
});

await agent.voice.connect();

agent.voice.on('speaker', audioStream => {
  playAudio(audioStream);
});

agent.voice.on('writing', ({ text, role }) => {
  console.log(`${role}: ${text}`);
});

await agent.voice.speak('How can I help you today?');

const microphoneStream = getMicrophoneStream();
await agent.voice.send(microphoneStream);
```

## Server-side tools

xAI executes `web_search`, `x_search`, `file_search`, and `mcp` tools server-side. Pass them through `serverTools` or `session.tools`; the provider merges both arrays into the initial `session.update`:

```typescript
const voice = new XAIRealtimeVoice({
  apiKey: process.env.XAI_API_KEY,
  serverTools: [
    { type: 'web_search' },
    {
      type: 'mcp',
      server_url: 'https://mcp.example.com/mcp',
      server_label: 'business-tools',
      allowed_tools: ['lookup_order'],
    },
  ],
});
```

Mastra function tools added with `addTools()` are converted into xAI function tools. When xAI emits function call events, this provider executes the Mastra tools, sends `function_call_output` items, and waits for all parallel tool calls to finish before sending the continuation `response.create`.

`send()` requires an open WebSocket connection. Call `connect()` first for live microphone streaming. Readable stream chunks must be binary audio chunks (`Buffer`, `ArrayBuffer`, or a typed array).

## Supported voices

- `eve`
- `ara`
- `rex`
- `sal`
- `leo`

Custom xAI voice IDs can also be used as the `speaker` value.

## Audio

The default input and output format is 24 kHz PCM16:

```typescript
const voice = new XAIRealtimeVoice({
  audio: {
    input: { format: { type: 'audio/pcm', rate: 24000 } },
    output: { format: { type: 'audio/pcm', rate: 24000 } },
  },
});
```

The provider also supports `audio/pcmu` and `audio/pcma` for telephony use cases. Those G.711 codecs use 8 kHz audio.
