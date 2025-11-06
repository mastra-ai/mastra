---
'@mastra/google-cloud-pubsub': minor
'@mastra/playground-ui': major
'@mastra/client-js': major
'@mastra/deployer': major
'@mastra/inngest': major
'@mastra/server': major
'@mastra/core': major
---

**Breaking Change**: Remove legacy v1 watch events and consolidate on v2 implementation.

This change simplifies the workflow watching API by removing the legacy v1 event system and promoting v2 as the standard (renamed to just `watch`).

### What's Changed

- Removed legacy v1 watch event handlers and types
- Renamed `watch-v2` to `watch` throughout the codebase
- Removed `.watch()` method from client-js SDK (`Workflow` and `AgentBuilder` classes)
- Removed `/watch` HTTP endpoints from server and deployer
- Removed `WorkflowWatchResult` and v1 `WatchEvent` types
