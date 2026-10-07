---
'@mastra/braintrust': patch
'@mastra/langfuse': patch
'@mastra/client-js': patch
'@mastra/datadog': patch
'@mastra/posthog': patch
'@mastra/observability': patch
'@mastra/server': patch
'@mastra/core': patch
---

Fixed channel bot tokens and other internal Mastra state leaking into traces ([#25893](https://github.com/mastra-ai/mastra/issues/25893)).

Agents with `channels` configured exported the live Telegram/Slack adapter on every span's `requestContext`, including bot and app tokens, and added hundreds of KB to each span. Delegated runs exported the parent agent's memory instance, and agent-controller runs walked the whole workspace.

**What changed**

- Reserved Mastra request-context keys (those starting with `mastra__` or `__mastra_`) are no longer exported on spans or in scorer request-context records. The auth token is now omitted instead of shown as `[REDACTED]`. Thread and resource IDs are still recorded as span metadata.
- Workspaces now show as `{ id, name, status }` in traces instead of exposing their configuration and providers.
- Your own request-context values are unchanged and keep their full detail.
