# @mastra/telnyx

## 0.1.0

Initial release with Telnyx telephony tool provider.

### Features

- **TelnyxToolProvider**: Implements Mastra's `ToolProvider` interface for integration with agents
- **telnyx_send_sms**: Send SMS text messages via Telnyx API
- **telnyx_make_call**: Make voice calls using Telnyx Call Control
- **telnyx_hangup_call**: Hang up active voice calls
- **telnyx_lookup_number**: Lookup phone number information

### Setup

1. Install: `npm install @mastra/telnyx telnyx`
2. Configure with Telnyx API key and phone number
3. Resolve tools for agent use
