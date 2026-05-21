---
'@mastra/core': minor
---

Added new editor configuration primitives for browser providers, agent builder integration, and stored-agent visibility.

**New: `BrowserProvider` interface**

Implement a browser provider to expose browser automation tools to agents via the editor. Each provider declares an id, name, and config schema, then returns a `MastraBrowser` instance from `createBrowser`.

```ts
import type { BrowserProvider } from '@mastra/core/editor';

const myProvider: BrowserProvider = {
  id: 'my-browser',
  name: 'My Browser',
  description: 'Custom browser automation',
  configSchema: z.object({ apiKey: z.string() }),
  createBrowser: async config => {
    return createMyBrowser(config.apiKey);
  },
};
```

**New: `MastraEditorConfig.browsers` and `.builder`**

Wire browser providers and agent-builder options into the editor:

```ts
new MastraEditor({
  browsers: { 'my-browser': myProvider },
  builder: { features: { agent: { favorites: true } } },
});
```

**New: `visibility` on `updateAgentMeta`**

Set an agent's visibility (private or public) through the editor namespace:

```ts
await editor.agent.updateAgentMeta('agent-id', { visibility: 'public' });
```
