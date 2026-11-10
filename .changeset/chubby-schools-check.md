---
'@mastra/core': patch
---

**Smaller agent run streams**

- Fixed agent run streams growing with every step. A registered Agent publishes each run so it can be observed and resumed, and each step used to repeat the whole prompt and every earlier step. Long runs no longer store either on every event.
- A delegated agent's streamed steps are reduced the same way.

**Observer improvements**

- `agent.observe()` on a plain Agent run now receives each step's content.
- The observer's `onFinish` now reports the run's text and tool calls, and each step's reasoning, sources and files.
