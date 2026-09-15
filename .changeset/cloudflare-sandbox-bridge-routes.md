---
'@mastra/cloudflare-sandbox': patch
---

Expose the remaining Cloudflare Sandbox Bridge routes through the adapter instead of requiring hand-rolled `fetch` calls. `CloudflareSandboxBridgeClient` gains typed `readFile`, `persistWorkspace`, `hydrateWorkspace`, `mountBucket`, `unmountBucket`, `createSession`, and `deleteSession` methods that reuse the existing auth, path-encoding, and `CloudflareSandboxBridgeError` handling. `CloudflareSandbox` additionally surfaces `readFile`, `persistWorkspace`, and `hydrateWorkspace`, letting a multi-turn agent read generated files back and back up or restore `/workspace` across container sleep. Resolves the persistence need in #23706. Fixes #23861.
