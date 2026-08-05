---
'@mastra/express': patch
'@mastra/fastify': patch
'@mastra/hono': patch
'@mastra/koa': patch
'@mastra/server': patch
---

Added a clear server warning when a webhook is sent to an agent without a matching channel adapter. No adapter setup is needed for the warning:

```sh
curl -X POST http://localhost:4111/api/agents/support/channels/slack/webhook
```

The server keeps the 404 response and logs:

```text
Received a Slack webhook, but this agent doesn't have a Slack adapter. Add one to the agent's channels.adapters configuration and restart the server.
```
