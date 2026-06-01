---
'@mastra/browser-firecrawl': minor
---

Initial release: Firecrawl Browser Sandbox integration for Mastra.

`FirecrawlBrowser` extends `AgentBrowser` to run the same deterministic browser tools (snapshot+refs, 16 tools, Playwright over CDP) against Firecrawl's cloud-hosted Chrome instances instead of local or self-hosted browsers.

**Features:**

- Cloud-hosted Chrome via Firecrawl Browser Sandbox API
- Same tool surface as `@mastra/agent-browser` (~16 browser automation tools)
- Thread-scoped browser isolation (`scope: 'thread'`)
- Automatic session cleanup on close

**Usage:**

```typescript
import { FirecrawlBrowser } from '@mastra/browser-firecrawl';

const browser = new FirecrawlBrowser({
  firecrawlApiKey: process.env.FIRECRAWL_API_KEY,
  scope: 'thread',
});

const agent = mastra.getAgent('my-agent', { browser });
```
