---
"@mastra/railway": minor
---

Add `@mastra/railway`, a sandbox provider for [Railway Sandboxes](https://docs.railway.com/sandboxes).

Provisions ephemeral, isolated Linux VMs on Railway through the Railway
TypeScript SDK and exposes them as a Mastra `WorkspaceSandbox`. Supports command
execution with streaming output and timeouts, background process management,
configurable idle timeout, `ISOLATED`/`PRIVATE` network isolation, custom base
images via the Railway template builder, forking a running sandbox into a new
one, and reattaching to an existing sandbox by ID. Also exports
`railwaySandboxProvider` for registration with `MastraEditor`.
