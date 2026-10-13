---
'@mastra/restate': minor
---

Added `createRestateAgent()` factory that wraps a Mastra agent with Restate durable execution. Agent invocations are journaled as Restate steps so completed LLM calls and tool side effects replay from the journal instead of re-executing after a crash. Tool approvals suspend durably via Restate awakeables and resume across process restarts. Includes `stream`, `resume`, `generate`, `resumeGenerate`, `prepare`, `observe`, `approveToolCall`, `declineToolCall`, plus `connect`/`serve` helpers and a full test suite.

```typescript
const durableAgent = createRestateAgent({ agent, restate: { url: 'http://localhost:8080' } });
const mastra = new Mastra({ agents: { myAgent: durableAgent } });
const { output } = await durableAgent.stream('Hello!');
```
