---
'@mastra/inngest': patch
'@mastra/core': patch
---

Refactor internal event system from Emitter to PubSub abstraction for workflow event handling. This change replaces the EventEmitter-based event system with a pluggable PubSub interface, enabling support for distributed workflow execution backends like Inngest. Adds `close()` method to PubSub implementations for proper cleanup.
