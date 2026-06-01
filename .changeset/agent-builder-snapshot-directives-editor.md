---
'@mastra/editor': patch
---

Trimmed the Agent Builder system prompt so it defers to the per-field directives in the form snapshot instead of restating which setters to call and in what order. Combined with the snapshot rewrite in `@internal/playground`, this removes a class of failures where the builder would re-call setters on already-correct fields (notably `set-agent-model` with empty payloads) or stall before writing `set-agent-instructions`.
