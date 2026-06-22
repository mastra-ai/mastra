---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Add a `matchArgs` mode to item-level static tool mocks. `matchArgs: 'strict'` (default) keeps deep-equality argument matching; `matchArgs: 'ignore'` matches on the tool name only. This makes mocking sub-agent delegation calls (`agent-<name>`) reliable, since their `prompt` and runtime-injected arguments are not stable. When a mock is derived from a trace, sub-agent delegation calls are now authored with `matchArgs: 'ignore'` automatically.
