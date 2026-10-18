---
'@mastra/factory': patch
---

Factory now allows Mastra Platform sign-in on `*.localhost` hosts (for example `my-branch.factory.localhost`), not only on `localhost` itself. Browsers resolve these names to the loopback address (RFC 6761), so local dev proxies that give each worktree its own name no longer get the "custom domain unsupported" error.
