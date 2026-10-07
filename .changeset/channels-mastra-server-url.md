---
'@mastra/slack': patch
'@mastra/telegram': patch
'@mastra/teams': patch
---

Channel providers now honor the `MASTRA_SERVER_URL` environment variable when deriving the server's public URL for OAuth callbacks and webhook registration. Deployed servers bind an address like `0.0.0.0:3000` that is never reachable from the outside, which broke Slack OAuth redirects, Telegram `setWebhook` (HTTPS required), and Teams messaging endpoints. Set `MASTRA_SERVER_URL` to the deployment's public HTTPS URL and channels work without passing `server: { studioHost, studioProtocol, studioPort }` to the `Mastra` instance; explicit `baseUrl` provider config and `server.studio*` overrides still take precedence.
