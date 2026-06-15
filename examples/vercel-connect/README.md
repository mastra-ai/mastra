# Vercel Connect + Mastra

Use [Vercel Connect](https://vercel.com/connect) to give your Mastra agents secure, short-lived tokens for third-party APIs at runtime — no long-lived secrets required.

## How it works

Vercel Connect manages OAuth flows and token exchange. Inside each Mastra tool's `execute` function, call `getToken()` from `@vercel/connect` to obtain a scoped provider token:

```ts
import { createTool } from '@mastra/core/tools';
import { getToken } from '@vercel/connect';
import { z } from 'zod';

const slackPostMessage = createTool({
  id: 'slack-post-message',
  description: 'Post a message to Slack',
  inputSchema: z.object({
    channel: z.string(),
    text: z.string(),
  }),
  execute: async ({ channel, text }) => {
    // Vercel Connect returns a short-lived Slack token
    const token = await getToken('slack/my-slack', {
      subject: { type: 'app' },
      scopes: ['chat:write'],
    });

    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channel, text }),
    });

    return res.json();
  },
});
```

The agent uses these tools like any other Mastra tool — Connect is invisible to the LLM.

## Prerequisites

1. A [Vercel](https://vercel.com) project with Connect enabled
2. Connectors created via the CLI:
   ```bash
   vercel connect create slack --name my-slack
   vercel connect create github --name my-github
   ```
3. For local dev, link and pull the OIDC token:
   ```bash
   vercel link
   vercel env pull
   ```

## Getting started

```bash
cd examples/vercel-connect
pnpm install --ignore-workspace
cp .env.example .env   # fill in your values
```

### Run the agent directly

```bash
pnpm start
```

### Run with Mastra Studio

```bash
pnpm mastra dev
```

Open [http://localhost:4111](http://localhost:4111) to chat with the Connect Agent in Studio.

## Included tools

| Tool | Service | What it does |
|------|---------|-------------|
| `slack-post-message` | Slack | Post a message to a channel |
| `slack-list-channels` | Slack | List public channels |
| `github-create-issue` | GitHub | Create an issue in a repo |
| `github-list-repos` | GitHub | List accessible repositories |

## Extending

Add tools for any [supported connector](https://vercel.com/docs/connect) (Linear, Notion, Salesforce, etc.) using the same `getToken()` pattern. Vercel Connect also supports user-scoped tokens (`subject: { type: 'user', id: '...' }`) for acting on behalf of specific users.
