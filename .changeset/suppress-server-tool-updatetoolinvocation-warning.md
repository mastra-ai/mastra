---
'@mastra/core': patch
---

Stop logging a spurious `updateToolInvocation: no matching tool call found` warning for same-stream provider-executed tool results

When a provider-executed (server-side) tool returns its result in the same stream step as its call — e.g. Anthropic native code execution — there is no preceding `state:'call'` message part yet, so the inline `updateToolInvocation` patch in the agentic loop returns `false` and logged a misleading warning on every such call. The message history was already correct (`buildMessagesFromChunks` merges the call + result), so this was log noise, not a correctness issue.

`updateToolInvocation` now accepts an optional `{ warnOnMissing }` flag (default `true`); the same-stream call site passes `warnOnMissing: false`. The warning is unchanged for all other callers, where a miss is genuinely unexpected.

Resolves #19182.
