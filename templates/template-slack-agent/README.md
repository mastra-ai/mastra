# Slack + Mastra

A pattern for connecting Slack bots to Mastra agents with streaming responses and conversation memory.

This example includes two demo agents (reverse, caps) — each gets its own Slack app and webhook route.

## How It Works

```
Slack message → /slack/{app}/events → Mastra agent → streaming response back to Slack
```

- **One Slack app per agent** — each agent has its own bot token and signing secret
- **Streaming updates** — shows typing indicators while the agent thinks/uses tools
- **Thread memory** — conversations are scoped to Slack threads via Mastra memory

## Setup

### 1. Install

```bash
pnpm install
```

### 2. Environment Variables

Create `.env`:

```bash
OPENAI_API_KEY=sk-your-key

# Each Slack app needs its own credentials
SLACK_REVERSE_BOT_TOKEN=xoxb-...
SLACK_REVERSE_SIGNING_SECRET=...

SLACK_CAPS_BOT_TOKEN=xoxb-...
SLACK_CAPS_SIGNING_SECRET=...
```

### 3. Create Slack Apps

For each agent you want to expose:

1. [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. **OAuth & Permissions** → Add Bot Token Scopes and Get Token:
   - `app_mentions:read` — receive @mentions
   - `channels:history` — read messages in public channels
   - `chat:write` — send messages
   - `im:history` — read direct messages
   - Copy Bot User OAuth Token to .env
3. **Event Subscriptions** → Enable and set Request URL:
   - `https://your-server.com/slack/{agentName}/events`
4. Subscribe to bot events: `app_mention`, `message.im`
5. **Agents & AI Apps** → Toggle on to enable agent features
6. **Basic Information** → copy Signing Secret to .env

### 4. Run

```bash
# Dev with ngrok for webhooks
ngrok http 4111
pnpm dev
```

## Adding Your Own Agents

### 1. Create the Agent

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

export const myAgent = new Agent({
  name: 'my-agent',
  instructions: 'Your agent instructions...',
  model: 'openai/gpt-4o-mini',
  memory: new Memory({ options: { lastMessages: 20 } }),
});
```

### 2. Register with Mastra

```typescript
// src/mastra/index.ts
import { myAgent } from './agents/my-agent';

export const mastra = new Mastra({
  agents: { myAgent },
  // ...
});
```

### 3. Add Slack Route

```typescript
// src/mastra/slack/routes.ts
const slackApps: SlackAppConfig[] = [
  {
    name: 'my-agent', // Route: /slack/my-agent/events
    botToken: process.env.SLACK_MY_AGENT_BOT_TOKEN!,
    signingSecret: process.env.SLACK_MY_AGENT_SIGNING_SECRET!,
    agentName: 'myAgent', // Must match key in mastra.agents
  },
];
```

### 4. Create Slack App & Add Env Vars

Follow the Slack app setup above, then add the credentials to `.env`.

## Project Structure

```
src/mastra/
├── agents/
│   ├── caps-agent.ts       # Simple text transformation agent
│   └── reverse-agent.ts    # Agent with tool + workflow capabilities
├── slack/
│   ├── chunks.ts           # Handle nested streaming chunk events
│   ├── constants.ts        # Animation timing configuration
│   ├── routes.ts           # Slack webhook handlers (creates one per app)
│   ├── status.ts           # Format status text with spinners
│   ├── streaming.ts        # Stream agent responses to Slack
│   ├── types.ts            # TypeScript type definitions
│   ├── utils.ts            # Helper functions
│   └── verify.ts           # Slack request signature verification
├── workflows/
│   └── reverse-workflow.ts # Multi-step text transformation workflow
└── index.ts                # Mastra instance with agents and routes
```

## Key Files

- **`routes.ts`** — Defines webhook endpoints and maps Slack apps to agents
- **`streaming.ts`** — Streams responses with animated spinners and tool/workflow indicators
- **`status.ts`** — Formats status messages (thinking, tool calls, workflow steps)
- **`verify.ts`** — Validates Slack request signatures for security
