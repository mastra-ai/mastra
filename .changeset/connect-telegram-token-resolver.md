---
'@mastra/connect': patch
---

Telegram channels now run in delegated credential mode: the provider receives a platform-backed `tokenResolver` instead of a static bot token, so a token re-pasted or rotated on the platform takes effect on the very next Bot API call without a snapshot refresh, and the bot token is never persisted in provider storage.

```ts
import { channels } from '@mastra/connect';

// Telegram is wired automatically — the resolver reads the current
// connection's api-key credential per Bot API call. No app-side config.
const registrations = await channels({ projectId: process.env.MASTRA_PROJECT_ID! });
```
