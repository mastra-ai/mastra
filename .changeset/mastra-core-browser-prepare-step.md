---
"@mastra/core": patch
---

Added `getPrepareStep()` to `MastraBrowser`. Agents now use a browser's `prepareStep` by default when `new Agent({ browser })` is configured, so browser-driven step hooks (for example, AgentBrowser's WebMCP mid-turn tool discovery) run without extra wiring. A user-supplied `prepareStep` (per-call or in `defaultOptions`) still takes precedence.

```typescript
import { Agent } from '@mastra/core/agent'
import { AgentBrowser } from '@mastra/agent-browser'

const browser = new AgentBrowser({ webmcp: { enabled: true } })

const agent = new Agent({ name: 'shop', instructions: '…', model, browser })

// Browser's prepareStep runs automatically — no `prepareStep` option needed.
await agent.generate('Add 2 of sku-9 to the cart')
```
