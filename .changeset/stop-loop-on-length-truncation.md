---
'@mastra/core': patch
---

fix(core): stop agent loop when finishReason is 'length' with pending tool calls

When `max_tokens` truncates a response mid-tool-call, the agent loop now terminates
instead of retrying indefinitely. Previously, `hasPendingToolCalls` overrode the
`finishReason === 'length'` check, causing the same truncation on every iteration
until `maxSteps` was exhausted.
