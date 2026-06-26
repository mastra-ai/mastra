---
'@mastra/slack': patch
---

Normalize trailing slashes in the Slack provider `baseUrl`. A `baseUrl` with a trailing slash (e.g. `MASTRA_BASE_URL=https://example.com/`) previously produced double-slash callback URLs like `https://example.com//slack/oauth/callback`, which broke the OAuth flow and webhook delivery. The trailing slash is now stripped, so callback URLs are always well-formed.
