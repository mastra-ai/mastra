---
'@mastra/platform-workspace': patch
---

`PlatformSandbox.getInfo()` no longer asks the workspace proxy about a `sandboxId` the sandbox has not started with in this process. A persisted reattach hint is only confirmed by `start()`; asking the proxy first surfaced `404 not_found` on the first tool call of a resumed session. The class also exposes `sandboxId`, the platform's id for the running sandbox, so callers persist an id the proxy recognises.
