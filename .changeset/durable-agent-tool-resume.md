---
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed durable agents (`createInngestAgent`) so resuming a run that suspended inside a tool now delivers the resume payload to that tool and drives the run to completion. Previously the nested agentic loop re-ran from scratch on resume: the tool re-executed without its resume data, its memoized suspended step-update collided, and the run stayed suspended forever.

```ts
const durableAgent = createInngestAgent({ agent, inngest });

// suspends inside a tool that calls suspend()
const { runId } = await durableAgent.stream(messages, { runId });

// now delivers { approved: true } to the suspended tool and finishes the run
await durableAgent.resume(runId, { approved: true });
```
