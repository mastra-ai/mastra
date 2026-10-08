---
'@mastra/core': patch
---

Fixed channel bot tokens and other internal Mastra state leaking into traces and score records ([#25893](https://github.com/mastra-ai/mastra/issues/25893)).

Agents with `channels` configured exported the live Telegram/Slack adapter on every span's `requestContext`, including bot and app tokens, and added hundreds of KB to each span. Delegated runs exported the parent agent's memory instance, and agent-controller runs walked the whole workspace.

**What changed**

- Reserved Mastra request-context keys (those starting with `mastra__` or `__mastra_`) are no longer exported on spans or saved on score records. The auth token is now omitted instead of shown as `[REDACTED]`. Thread and resource IDs are still recorded as span metadata.
- Workspaces now show as `{ id, name, status }` in traces and score records instead of exposing their configuration and providers. Score records also use `serializeForSpan()` for any other object that defines it.
- Request-context keys without a reserved prefix keep their existing representation. If you set your own keys starting with `mastra__` or `__mastra_`, rename them to keep them in traces.
