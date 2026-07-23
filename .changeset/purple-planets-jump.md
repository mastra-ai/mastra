---
'@mastra/slack': minor
---

Added `SlackUserAuth` for connecting a Slack **user account** to a pre-existing Slack app (PKCE OAuth, no client secret). Tokens refresh automatically before expiry and rotated refresh tokens are persisted safely, so connections survive Slack's token rotation across restarts.

```ts
import { SlackUserAuth } from '@mastra/slack';

const auth = new SlackUserAuth({ clientId: '1234567890.123' });
await auth.connect({ onAuthUrl: url => console.log('Authorize:', url) }); // opens PKCE browser flow
const token = await auth.getToken(); // transparently refreshed user token
```

Credentials are stored in `~/.mastra/slack-auth.json` by default, with a pluggable storage interface and a static `token` option for headless use.
