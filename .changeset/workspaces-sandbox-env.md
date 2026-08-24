---
'@mastra/agentcore': patch
'@mastra/apple-container': patch
'@mastra/blaxel': minor
'@mastra/cloudflare-sandbox': patch
'@mastra/daytona': patch
'@mastra/docker': patch
'@mastra/e2b': patch
'@mastra/modal': patch
'@mastra/platform-workspace': patch
'@mastra/railway': minor
'@mastra/vercel': patch
---

Honor the sandbox runtime environment (`setEnv()`/`getEnv()` from `@mastra/core`) in every workspace sandbox provider. Environment variables set after construction now reach subsequent commands on all providers:

- Process-manager-routed providers (E2B, Blaxel, Cloudflare, Daytona, Docker, Modal, Vercel microVM spawns) inherit the merge from the core spawn wrapper; their duplicated per-manager env plumbing is removed.
- Providers with their own exec transports (AgentCore, Apple Container, Railway, Vercel microVM and serverless `executeCommand`, Platform's private-network, WebSocket lease, and E2B lease paths) now merge `getEnv()` under per-call env.

Constructor `env` continues to behave as before: it seeds the sandbox runtime environment, and providers that bake env into the VM or container at creation time (Docker, Modal, Railway, Apple Container, Vercel, Platform) still do so. Per-call `env` on `executeCommand` still takes precedence for that command only.

Removed exported types (minor bump for these two packages): `BlaxelProcessManagerOptions` from `@mastra/blaxel` and `RailwayProcessManagerOptions` from `@mastra/railway`. Both existed only to pass `env` into a process manager constructed by hand; the core spawn wrapper now owns that merge, so the option and its type are gone.
