---
'@mastra/core': minor
'@mastra/memory': minor
---

Changes to an experimental, upcoming memory feature.

`experimental_subconscious` and the Memory `knowledge` option are removed: setting either now throws, saying to attach Knowledge to the agent instead (`knowledge: false` is still accepted). `Subconscious` and `KnowledgeSemanticIndexCoordinator` stay exported from `@mastra/memory` so older code still loads, and throw when constructed. `@mastra/core/knowledge` exports `Knowledge` with its option and result types and the Knowledge storage domain; the tool, pin and semantic-index helpers are internal.

Agent `scopes` are read-only unless marked writable: `scopes: ['org:acme', { scope: 'team:core', access: 'write' }]` lets the run read both and write only to `team:core`. `resource:` and `thread:` scopes, the run's Memory identity, are always writable. When the agent, the call and the request context name the same scope with different access, read-only wins.

A message can carry its own scopes: `session.sendMessage({ content, scopes })`. A run's scopes are fixed when it starts, so a message whose scopes differ from the running run's waits for it to end, then starts its own run in the same conversation. `sendSignal` reports this as `{ action: 'blocked', reason: 'scope-mismatch', runId }`. `queueMessage`, `queueSignal`, `sendNotificationSignal` and `steer` take `scopes` the same way: a queued or steering message, or a notification, whose scopes differ from the running run's starts its own run with its scopes after that run instead of joining it. A deferred notification keeps the scopes it was sent with. Scopes are set in process only: remote callers (the agent controller HTTP routes and `@mastra/client-js`) can't send them. To derive scopes from a request, give the agent a `scopes` function that reads trusted request context. When the thread's claimed owner runs in another process, a message with scopes isn't queued: `sendMessage` rejects with an error saying scopes don't cross processes. Messages without scopes still join that owner's run.

Attach Knowledge with `new Agent({ knowledge, scopes })`. Tools are off by default: `new Knowledge({ tools: true })` gives the read and write tools, `tools: { read: true }` the read tools only, and `pinnedContext: true` (or `{ maxPins, maxTokens }`) delivers pinned entries every turn and adds `knowledge_pin`.

The Knowledge tools are five: `knowledge_search`, `knowledge_read` (reads a node by id or name, or lists nodes; replaces `knowledge_browse`), `knowledge_record` (`op: 'add' | 'remove' | 'rescope'`; `add` replaces `knowledge_create` and `knowledge_append`), `knowledge_node` (`op: 'update' | 'write' | 'merge'`; replaces the rename, kind, description, content and merge tools) and `knowledge_pin` (`op: 'pin' | 'edit' | 'unpin'`).
