---
'@mastra/platform-workspace': patch
---

Fixed platform sandbox reattach and made provisioning resilient to transient proxy failures:

- The workspace proxy assigns its own sandbox id on create (the advisory id in the request body is not honored), but `getInfo()` never exposed it, so callers persisting a reattach id (e.g. the Factory sandbox fleet, which reads `metadata.sandboxId`) stored the locally generated construction id instead. Every reattach then 404'd and each session open provisioned a brand-new sandbox and re-cloned the repository. `getInfo()` now reports the platform-assigned id in `metadata.sandboxId`, and `start()` treats a sandbox record with `destroyedAt` set as gone (falls through to a fresh provision) instead of pointing exec at a dead resource.
- Sandbox creation retries transient workspace-proxy 5xx responses with a short backoff. Provisioning intermittently fails with proxy 500s while the provider is under load; a retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.
