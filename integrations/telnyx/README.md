# @mastra/telnyx

Telnyx telephony tool provider for Mastra agents. Enable your AI agents to send SMS messages, make voice calls, and manage telephony operations.

## Features

- **Send SMS**: Send text messages to any phone number
- **Make Voice Calls**: Initiate phone calls using Telnyx Call Control
- **Hang Up Calls**: End active voice calls
- **Number Lookup**: Look up information about phone numbers

## Installation

```bash
npm install @mastra/telnyx telnyx
```

## Prerequisites

1. **Telnyx Account**: Sign up at [telnyx.com](https://telnyx.com)
2. **API Key**: Get your API key from the [Telnyx Portal](https://portal.telnyx.com)
3. **Phone Number**: Purchase or port a phone number in the Telnyx Portal
4. **Messaging Profile** (optional): Create a messaging profile for SMS in the portal

## Usage

### Basic Setup

```typescript
import { TelnyxToolProvider } from '@mastra/telnyx';

const telnyxProvider = new TelnyxToolProvider({
  apiKey: process.env.TELNYX_API_KEY!,
  fromNumber: process.env.TELNYX_FROM_NUMBER, // e.g., '+15551234567'
  messagingProfileId: process.env.TELNYX_MESSAGING_PROFILE_ID, // optional
});
```

### With Mastra Agent

```typescript
import { Mastra } from '@mastra/core';
import { TelnyxToolProvider } from '@mastra/telnyx';

const telnyxProvider = new TelnyxToolProvider({
  apiKey: process.env.TELNYX_API_KEY!,
  fromNumber: process.env.TELNYX_FROM_NUMBER,
});

// Get tools for agent use
const tools = await telnyxProvider.resolveTools([
  'telnyx_send_sms',
  'telnyx_make_call',
]);

// Use with your agent
```

### Environment Variables

```bash
TELNYX_API_KEY=your_api_key_here
TELNYX_FROM_NUMBER=+15551234567
TELNYX_MESSAGING_PROFILE_ID=your_profile_id  # optional
```

## Available Tools

| Tool | Description |
|------|-------------|
| `telnyx_send_sms` | Send an SMS text message |
| `telnyx_make_call` | Make a voice phone call |
| `telnyx_hangup_call` | Hang up an active call |
| `telnyx_lookup_number` | Lookup phone number information |

### telnyx_send_sms

Send an SMS text message to a phone number.

**Parameters:**
- `to` (required): Destination phone number in E.164 format (e.g., `+15551234567`)
- `body` (required): Text message content
- `from` (optional): Sender phone number (uses default if not provided)

### telnyx_make_call

Make a voice phone call using Telnyx Call Control.

**Parameters:**
- `to` (required): Destination phone number in E.164 format
- `from` (optional): Caller phone number (uses default if not provided)
- `webhook_url` (optional): URL for receiving call status events

### telnyx_hangup_call

Hang up an active voice call.

**Parameters:**
- `call_control_id` (required): The call control ID from `telnyx_make_call`

### telnyx_lookup_number

Lookup information about a phone number.

**Parameters:**
- `phone_number` (required): Phone number to lookup in E.164 format

## Phone Number Format

All phone numbers must be in E.164 format:
- Start with `+`
- Include country code
- No spaces or dashes
- Example: `+15551234567`

## Error Handling

All tools return descriptive error messages for:
- Missing or invalid API keys
- Missing phone numbers
- Invalid phone number formats
- API communication errors
- Missing `telnyx` package

## Documentation

- [Telnyx API Reference](https://developers.telnyx.com/docs/api/v2/overview)
- [Telnyx Python SDK](https://github.com/team-telnyx/telnyx-python)
- [Telnyx Call Control](https://developers.telnyx.com/docs/api/v2/call-control)
- [Mastra Documentation](https://mastra.ai/docs)

## License

Apache-2.0
