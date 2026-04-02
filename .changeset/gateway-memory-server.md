---
'@mastra/server': minor
---

Added Memory Gateway proxying for agents using Mastra Gateway models.

When an agent uses a `mastra/` model string, memory operations (threads, messages, observational memory) are automatically proxied to the remote Mastra Gateway instead of local storage.

**New endpoints:**

- **GET /memory/observational-memory** — retrieves the current observational memory record and optional generation history for an agent
- **POST /memory/observational-memory/buffer-status** — waits for in-flight buffering operations to complete (30s timeout) and returns the updated record

**New internal module:**

- `GatewayMemoryClient` — HTTP client that proxies memory operations to the Mastra Gateway REST API, with automatic format conversion between gateway and local response types
