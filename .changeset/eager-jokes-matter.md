---
'@mastra/core': minor
'@mastra/memory': patch
---

Added data-part signals — a new signal type that streams to subscribers but is never seen by the LLM. Data-part signals always persist when idle and never wake the agent. Use `agent.sendDataPartSignal({ type: 'data-...', data: {...} }, { resourceId, threadId })` from the Agent, or `context.sendDataPartSignal({ type: 'data-...', data: {...} })` from within processors.
