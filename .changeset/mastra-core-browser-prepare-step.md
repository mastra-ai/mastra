---
"@mastra/core": patch
---

Added `Agent.registerPrepareStep(hook)` — a general registration API that lets any member (or user code) contribute a `prepareStep` hook that the agent composes with every other registered hook and with the user's own `defaultOptions.prepareStep`. The returned function unregisters the hook. Hooks run in registration order; each sees the args as modified by previous hooks. Their partial results are merged into one `ProcessInputStepResult`: `tools` entries accumulate (later hooks win on same tool name); every other field is last-write-wins. The user's `defaultOptions.prepareStep` runs last so it can override any field.

Browsers can opt in by implementing an optional `MastraBrowser.getPrepareStep()`. The Agent auto-registers it so browser-driven step hooks (for example, AgentBrowser's WebMCP mid-turn tool discovery) run without extra wiring. The registration is also re-wired when `setBrowser()` swaps the browser.

```typescript
import { Agent } from '@mastra/core/agent'
import { AgentBrowser } from '@mastra/agent-browser'

const browser = new AgentBrowser({ webmcp: { enabled: true } })

const agent = new Agent({ name: 'shop', instructions: '…', model, browser })

// Browser's prepareStep runs automatically — no `prepareStep` option needed.
await agent.generate('Add 2 of sku-9 to the cart')

// Ad-hoc hooks are composed with the browser's hook and the user's own.
const unregister = agent.registerPrepareStep(async args => ({ tools: { extra: /* ... */ } }))
```
