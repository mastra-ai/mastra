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

`mastra connect add <provider>` connects a provider. If the organization already has connections for that provider, the command offers to attach one of them instead of authorizing again. Otherwise OAuth providers open the provider's consent screen in your browser, while API key and Basic auth providers prompt for credentials in the terminal:

```bash
$ mastra connect add linear

Opening your browser to authorize Linear…
◇ Connection is active

Your organization's existing Linear connections:
  • Mastra   connected by Charlie Green  Sep 25, 2026
  • charlie  connected by Charlie Green  Oct 2, 2026

◆ Set a display name so this connection is easy to tell apart (leave blank to skip)
│ charlie 2

✓ Connected Linear (charlie 2) to My Project.
```

After a new connection goes active, the command suggests a unique display name so the connection is easy to tell apart later, and warns before saving a name that duplicates another connection's name.

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
