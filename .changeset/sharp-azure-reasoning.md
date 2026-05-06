---
'@mastra/core': minor
---

Fixed OpenAI-compatible response item handling so Azure OpenAI reasoning, text, and tool-call item IDs are preserved with the same ordering guarantees as OpenAI Responses. Cache keys now include the provider namespace for response item IDs, which prevents OpenAI and Azure metadata from colliding during message merging. Azure item IDs are also mirrored into the OpenAI-compatible option namespace expected by the current Azure provider input converter.

Existing in-memory message cache entries that were keyed by unprefixed response item IDs will miss after upgrade and be regenerated with provider-prefixed keys.

Duplicate Responses text parts with the same item ID now merge only across source annotations, not across tool boundaries.

Also exported provider-neutral response item helpers from `@mastra/core/agent/message-list` for callers that need to inspect whether a message part came from OpenAI or Azure response metadata.
