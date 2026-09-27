---
'@mastra/connect': minor
---

`channels()` now returns a live channel resolver instead of a fixed provider map. Channel connections created or removed on the Mastra platform are picked up by a running server automatically — no redeploy needed.

```typescript
import { Mastra } from '@mastra/core/mastra';
import { channels } from '@mastra/connect';

export const mastra = new Mastra({
  channels: await channels({ projectId: 'my-project' }),
});
```

The resolver keeps one provider instance per integration, refreshes platform connections on a configurable `ttlMs` cache (30 seconds by default), and re-applies credentials when a connection changes. Slack credentials are fetched fresh from the platform before each app-management call, so tokens refreshed by the platform are always honored.

Discord now sources its bot token from the connection's metadata (`botToken`, following Nango's Discord convention) instead of the OAuth credential — the OAuth access token is a user Bearer token that Discord rejects for bot auth, which previously surfaced as `Discord rejected the bot token: 401: Unauthorized`. A Discord connection without `botToken` metadata is skipped with a warning telling you to store the token on the connection.

If you previously awaited `channels()` and read providers off the result as a plain object, call the resolver instead: `const providers = await resolver()`.

Requires `@mastra/core` 1.72.0 or later — the first release whose `Mastra` constructor accepts a `ChannelsResolver` (the peer dependency range has been raised to match). Older cores treat the resolver as a static provider record and fail at construction.
