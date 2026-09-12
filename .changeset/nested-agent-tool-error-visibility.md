---
'@mastra/ai-sdk': patch
---

Fixed a nested agent's tool failure being invisible to AI SDK hosts. `transformAgent` had no case for `tool-error`, so a sub-agent whose tool threw emitted the same `data-tool-agent` parts as one whose tool succeeded and a host could not tell a failed delegated step apart from a successful one. Failures now appear in `data.toolErrors` as `{ toolCallId, toolName, args?, errorText, providerExecuted? }`, where `errorText` is a JSON-safe string (a raw `Error` serializes to `{}` over the wire), and they are also carried on the finished `data-tool-agent-step` payload. Runs where no tool throws are unchanged. Fixes #23022.
