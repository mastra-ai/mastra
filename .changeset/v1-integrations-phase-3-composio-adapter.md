---
'@mastra/core': minor
'@mastra/editor': minor
---

Add `ComposioToolIntegration` (extends `BaseToolIntegration`) alongside the existing `ComposioToolProvider`. The new class exposes `listToolServices` / `listTools` with pagination + search, single-connection `resolveTools` that injects `connectedAccountId` via the Composio SDK, and a full auth surface (`authorize`, `getAuthStatus`, batched `getConnectionStatus`, `getHealth`). Capabilities flag advertises multiple connections per service, batched status checks, and connection-id reuse on reauthorize. The legacy `ComposioToolProvider` remains exported and untouched.
