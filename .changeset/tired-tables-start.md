---
'@mastra/core': patch
---

Fixed DurableAgent ignoring the wrapped agent's defaultOptions. When wrapping an agent with createDurableAgent, the agent's configured defaultOptions (maxSteps, providerOptions, modelSettings, etc.) were silently dropped — maxSteps fell back to the durable default of 5 and provider settings like Anthropic thinking config were never sent. DurableAgent now merges the wrapped agent's defaultOptions under each per-request call, matching Agent.stream()/generate(), and delegates getDefaultOptions() to the wrapped agent.

Before:

const base = new Agent({ model, defaultOptions: { maxSteps: 250 } });
const agent = createDurableAgent({ agent: base });
// runs capped at 5 steps, defaultOptions.providerOptions dropped

After:

// defaultOptions.maxSteps (250) and providerOptions are honored; per-request options still take precedence
