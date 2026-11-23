---
'@mastra/factory': patch
---

Fixed review-thread resolution for Factories on platform-managed GitHub. `source_control_resolve_diff_thread` failed with "github does not support resolving review threads" because the platform-backed GitHub integration had no way to resolve threads. It now resolves and reopens review threads through the Mastra platform, the same way the self-hosted GitHub integration does.
