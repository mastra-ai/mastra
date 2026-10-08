---
'@mastra/platform-workspace': minor
---

Add `PlatformFactorySandbox`, the factory host contract for platform sandboxes. It owns the session sandbox constructor, the repo template with `cpuCount`, `memoryMb` and `idleTimeoutMinutes` settings, provider-side `defaults` (2 CPUs, 1024 MB and a 5 minute idle timeout when unset), and `builds.start`/`builds.get` over the platform template build API. The `platform-workspace start complete` log line now carries a `templateHash` of the serialized template definition. Sandboxes created through the class send the session id on proxy requests.
