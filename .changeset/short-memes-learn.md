---
'mastra': minor
---

Added a `mastra connect` command for wiring Mastra Connect provider integrations into a project straight from the terminal.

`mastra connect list` shows every provider in the integration catalog, highlighting the ones already connected to the linked project:

```bash
$ mastra connect list

Providers for My Project:

  ● linear — connected (charlie)
  ● posthog — connected (Mastra)
  ○ github
  ○ notion
  ○ slack
```

`mastra connect add <provider>` connects a provider. OAuth providers open the provider's consent screen in your browser, while API key and Basic auth providers prompt for credentials in the terminal:

```bash
$ mastra connect add linear

Opening your browser to authorize Linear…
◇ Connection is active

✓ Connected Linear (charlie) to My Project.
```

`mastra connect remove <provider>` unlinks a provider connection from the project (the org-level connection is kept):

```bash
$ mastra connect remove linear

✓ Removed linear (charlie) from My Project.
```

Connected providers become available to agents through `@mastra/connect`'s toolset resolver:

```ts
import { connect } from '@mastra/connect';

const tools = connect({
  projectId: process.env.MASTRA_PROJECT_ID,
  integrations: ['linear'],
});
```
