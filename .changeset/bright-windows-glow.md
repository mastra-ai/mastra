---
'@mastra/browser-viewer': minor
---

Initial release of @mastra/browser-viewer

Playwright-based browser viewer for CLI providers that enables screencast visualization in Studio. Supports thread-isolated browser sessions and automatic CDP connection management.

```typescript
import { BrowserViewer } from '@mastra/browser-viewer';

const workspace = new Workspace({
  sandbox: new LocalSandbox({ cwd: './workspace' }),
  browser: new BrowserViewer({
    headless: false,
  }),
});
```
