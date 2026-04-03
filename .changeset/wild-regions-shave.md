---
'@mastra/agent-browser': minor
---

Add browser automation support with screencast streaming, input injection, and thread isolation

**New Features:**

- Browser tools for web automation (navigate, click, type, scroll, extract, etc.)
- Real-time screencast streaming via WebSocket
- Mouse and keyboard input injection
- Thread-scoped browser isolation (`scope: 'thread'`)
- State persistence and restoration across sessions
- Support for cloud providers (Browserbase, Browser-Use, Browserless)

**Configuration:**

```typescript
import { AgentBrowser } from '@mastra/agent-browser';

const browser = new AgentBrowser({
  headless: true,
  scope: 'thread', // Each thread gets isolated browser
  viewport: { width: 1280, height: 720 },
});

const agent = mastra.getAgent('my-agent', { browser });
```
