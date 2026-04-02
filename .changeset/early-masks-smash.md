---
'@mastra/stagehand': minor
---

Add AI-powered browser automation with Stagehand SDK integration

**New Features:**

- AI-powered browser automation using Stagehand's act/extract/observe primitives
- Native Browserbase integration for cloud browser sessions
- Real-time screencast streaming via WebSocket
- Mouse and keyboard input injection
- Thread-scoped browser isolation (`scope: 'thread'`)
- State persistence and restoration across sessions

**Configuration:**

```typescript
import { StagehandBrowser } from '@mastra/stagehand';

// Local browser
const browser = new StagehandBrowser({
  headless: true,
  scope: 'thread',
});

// Browserbase cloud
const browser = new StagehandBrowser({
  env: 'BROWSERBASE',
  apiKey: process.env.BROWSERBASE_API_KEY,
  projectId: process.env.BROWSERBASE_PROJECT_ID,
});

const agent = mastra.getAgent('my-agent', { browser });
```
