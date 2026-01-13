# @mastra/voice-twilio

Twilio Voice integration for Mastra, enabling AI voice agents over phone calls using Twilio Media Streams.

## Installation

```bash
npm install @mastra/voice-twilio
```

## Configuration

The module requires Twilio credentials, which can be provided through environment variables or directly in the configuration:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
```

## Usage

```typescript
import { TwilioVoice } from '@mastra/voice-twilio';
import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

// Create a Twilio voice instance
const voice = new TwilioVoice({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  websocketUrl: 'wss://your-server.com/twilio',
});

// Create an agent with voice capabilities
const agent = new Agent({
  name: 'Phone Agent',
  instructions: 'You are a helpful phone assistant for customer support.',
  model: openai('gpt-4o'),
  voice,
});

// Handle incoming calls
voice.on('call-started', async ({ callSid, streamSid }) => {
  console.log(`Call started: ${callSid}`);
});

voice.on('audio-received', async ({ audio, streamSid }) => {
  // Audio is already converted to PCM format
  // Process with your AI provider
});

voice.on('call-ended', ({ callSid }) => {
  console.log(`Call ended: ${callSid}`);
});

// Generate TwiML for your webhook
const twiml = voice.generateTwiML();
```

## Features

- **Inbound PSTN Calls**: Handle incoming phone calls via Twilio
- **Real-time Audio Streaming**: Bidirectional WebSocket streaming with Twilio Media Streams
- **Audio Format Conversion**: Automatic conversion between mulaw (Twilio) and PCM (AI providers)
- **Turn-taking & Barge-in**: Support for natural conversation flow
- **Event-based Architecture**: Familiar event model matching other Mastra voice providers

## Events

The voice instance emits several events:

- `call-started`: Emitted when a new call connects
- `call-ended`: Emitted when a call disconnects
- `call-metadata`: Emitted with call details (SID, format, etc.)
- `audio-received`: Emitted when audio is received from caller (PCM format)
- `speaking`: Emitted when sending audio to caller
- `writing`: Emitted for transcriptions
- `error`: Emitted when an error occurs

## TwiML Integration

To connect Twilio calls to your Media Streams endpoint, configure your Twilio webhook to return the TwiML:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://your-server.com/twilio" />
  </Connect>
</Response>
```

Or use the `generateTwiML()` method to create this programmatically.

## Audio Format

Twilio Media Streams use:

- **Encoding**: μ-law (mulaw)
- **Sample Rate**: 8000 Hz
- **Channels**: 1 (mono)

The `TwilioVoice` class automatically converts between this format and 16-bit PCM used by most AI providers.

## API Reference

For detailed API documentation, see the [Mastra documentation](https://mastra.ai/docs/voice).

## Related

- [Twilio Media Streams Documentation](https://www.twilio.com/docs/voice/media-streams)
- [Mastra Voice Overview](https://mastra.ai/docs/voice)
- [Issue #11458](https://github.com/mastra-ai/mastra/issues/11458)
