---
'@mastra/server': patch
---

Fixed a startup crash that affected deployments pinning an older `@mastra/core` version. The server now boots successfully even when the installed `@mastra/core` doesn't include the Agent Builder runtime.

**Symptom**

Deployed servers failed to start with `ERR_MODULE_NOT_FOUND` pointing at `@mastra/core/dist/agent-builder/ee/index.js`, even on apps that never used the Agent Builder.

**What changed**

The server no longer eagerly loads the Agent Builder runtime at boot. It's loaded on demand, only when a request actually needs it on an app that has configured a `MastraEditor` with builder support.

No application code changes required.
