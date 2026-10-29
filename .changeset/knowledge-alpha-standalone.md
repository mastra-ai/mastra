---
'@mastra/core': minor
'@mastra/memory': minor
---

Changes to an experimental, upcoming memory feature.

`experimental_subconscious` and the Memory `knowledge` option are removed: setting either now throws, saying to attach Knowledge to the agent instead (`knowledge: false` is still accepted). `Subconscious` and `KnowledgeSemanticIndexCoordinator` stay exported from `@mastra/memory` so older code still loads, and throw when constructed. `@mastra/core/knowledge` exports `Knowledge` with its option and result types and the Knowledge storage domain; the tool, pin and semantic-index helpers are internal.

Agent `scopes` are read-only unless marked writable: `scopes: ['org:acme', { scope: 'team:core', access: 'write' }]` lets the run read both and write only to `team:core`. `resource:` and `thread:` scopes, the run's Memory identity, are always writable. When the agent, the call and the request context name the same scope with different access, read-only wins.

A message can carry its own scopes: `session.sendMessage({ content, scopes })`. A run's scopes are fixed when it starts, so a message whose scopes differ from the running run's waits for it to end, then starts its own run in the same conversation. `sendSignal` reports this as `{ action: 'blocked', reason: 'scope-mismatch', runId }`. `queueMessage`, `queueSignal`, `sendNotificationSignal` and `steer` take `scopes` the same way: a queued or steering message, or a notification, whose scopes differ from the running run's starts its own run with its scopes after that run instead of joining it. A deferred notification keeps the scopes it was sent with. Scopes are set in process only: remote callers (the agent controller HTTP routes and `@mastra/client-js`) can't send them. To derive scopes from a request, give the agent a `scopes` function that reads trusted request context. When the thread's claimed owner runs in another process, a message with scopes isn't queued: `sendMessage` rejects with an error saying scopes don't cross processes. Messages without scopes still join that owner's run.

Attach Knowledge with `new Agent({ knowledge, scopes })`. Knowledge needs `scopes`, the scope types its runs may hold and who gets which role on them: `new Knowledge({ storage, scopes: { ...knowledgeMemoryScopes() } })` declares Memory's `thread:`/`resource:` scopes and an `org:` scope; `{}` declares none. A run holding a scope that isn't declared fails. Tools are off by default: `tools: true` gives the read and write tools, `tools: { read: true }` the read tools only, and `pinnedContext: true` (or `{ maxPins, maxTokens }`) delivers pinned pages every turn and adds `knowledge_pin`. `knowledge.readScopeFor(principals)` returns what holders of those scopes can read, for host code reading the store directly.

Knowledge is a tree of pages. The tools are five: `knowledge_search`, `knowledge_read` (a page with its notes, or a scope's pages), `knowledge_page` (`op: 'write' | 'move' | 'merge'`), `knowledge_note` (`op: 'add' | 'restamp' | 'remove'`) and `knowledge_pin` (`op: 'pin' | 'unpin'`). Notes are at most about 250 tokens and page descriptions about 100; long text goes in a page body.
