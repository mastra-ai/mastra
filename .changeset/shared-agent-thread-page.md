---
'@mastra/playground-ui': minor
---

Hosts other than Studio can now build an agent page from the same parts Studio uses:

- Agent list and page: `AgentPage`, `AgentCombobox` and `AgentPageTabs`.
- Threads panel: `ThreadsPanelProvider` and `useThreadsPanel`.
- The agent thread page and chat integration.
- The memory sidebar (Observational Memory, memory details, thread cloning).
- The Config panel (memory settings, metadata badges, workspace tools).
- The skill create dialog.

Two options let a host fit the page to its own layout:

```tsx
// Put your own close or collapse control in the Config panel header
<AgentConfigSurface actions={<Button onClick={close}>Close</Button>}>{children}</AgentConfigSurface>

// Hide the memory capability icons in the thread sidebar (shown by default)
<AgentThreadPage {...pageProps} sidebarExtensions={{ showConfigBadges: false }} />
```

To clear saved drafts after a user signs out, await `clearDraftsOnLogout` with the API and user scope:

```ts
import { clearDraftsOnLogout } from '@mastra/playground-ui/domains/agents/chat';

await clearDraftsOnLogout(JSON.stringify([client.options.baseUrl, client.options.apiPrefix, userId]));
```
