---
'@mastra/platform-workspace': minor
---

Add `PlatformFactorySandbox`, the factory host contract for platform sandboxes. It owns the session sandbox constructor, the repo template with `cpuCount`, `memoryMb` and `idleTimeoutMinutes` settings, and provider-side `defaults`. The `platform-workspace start complete` log line now carries a `templateHash` of the serialized template definition. Sandboxes created through the class send the session id on proxy requests.
