# Mastra + Sendly SMS Agent Template

An AI agent that can send SMS messages, verify phone numbers, search message history, and check credit balance — powered by [Mastra](https://mastra.ai) and [Sendly](https://sendly.live).

## What's Included

**6 tools** wired to the Sendly SMS API:

| Tool | Description |
|------|-------------|
| `send-sms` | Send an SMS to any phone number worldwide |
| `verify-phone` | Send a one-time verification code (OTP) |
| `check-verification` | Verify the OTP code a user entered |
| `list-messages` | List recent sent messages with delivery status |
| `search-messages` | Full-text search through message history |
| `get-balance` | Check SMS credit balance |

**1 agent** (`sms-agent`) with all tools registered, ready to use in the Mastra Playground.

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Edit `.env` and add your keys:

```ini
SENDLY_API_KEY=sk_test_v1_...
OPENAI_API_KEY=sk-...
```

### 3. Run the agent

```bash
npm run dev
```

This starts the Mastra dev server with the Playground UI. Open the URL shown in your terminal to chat with the SMS Agent.

## Environment Variables

| Variable | Description | Where to get it |
|----------|-------------|-----------------|
| `SENDLY_API_KEY` | Sendly API key for SMS | [sendly.live/settings/api-keys](https://sendly.live/settings/api-keys) |
| `OPENAI_API_KEY` | OpenAI API key for the agent's LLM | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

## Sandbox Testing

Use a **test API key** (prefix `sk_test_`) to send messages without using real credits or delivering real SMS. Sandbox mode is perfect for development and testing.

**Magic test numbers:**
- `+15005550000` — always succeeds (delivered)
- `+15005550001` — invalid number error
- `+15005550006` — carrier rejected

Verification codes in sandbox mode are returned in the API response, so you can complete the full verify flow without a real phone.

## Usage Examples

Try these prompts in the Mastra Playground:

- "Send a message to +15005550000 saying 'Hello from my AI agent!'"
- "What's my current credit balance?"
- "Show me my last 5 messages"
- "Start phone verification for +15005550000"
- "Search my messages for 'appointment reminder'"
- "Send an appointment reminder to +15005550000 for tomorrow at 3pm"

## Project Structure

```text
src/mastra/
  index.ts              # Mastra configuration
  agents/
    sms-agent.ts        # Agent with instructions and tools
  tools/
    sendly.ts           # 6 Sendly SMS tools using createTool
```

## Customization

### Change the LLM model

Edit `src/mastra/agents/sms-agent.ts` and change the `model` field. Mastra supports any model in `provider/model` format:

```typescript
model: "openai/gpt-4o"          // default
model: "openai/gpt-4o-mini"     // faster, cheaper
model: "anthropic/claude-sonnet-4-5-20250514"   // Anthropic
model: "google/gemini-2.5-pro"  // Google
```

### Add more tools

Create new tools in `src/mastra/tools/` using `createTool` from `@mastra/core/tools`, then add them to the agent's `tools` object. See the [Sendly API docs](https://sendly.live/docs) for all available endpoints.

### Add memory

Install `@mastra/memory` and `@mastra/libsql` to give the agent conversation memory:

```typescript
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";

export const smsAgent = new Agent({
  // ...existing config
  memory: new Memory({
    storage: new LibSQLStore({
      url: "file:../mastra.db",
    }),
  }),
});
```

## Learn More

- [Mastra Docs](https://mastra.ai/docs) — framework reference
- [Sendly Docs](https://sendly.live/docs) — SMS API reference
- [Sendly Node SDK](https://www.npmjs.com/package/@sendly/node) — full SDK documentation
