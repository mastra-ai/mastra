---
'@mastra/client-js': patch
---

Fixed A2A client URLs to correctly include the API prefix. Previously, requests to agent card and A2A execution endpoints were missing the `/api/` prefix (e.g., `/.well-known/[agent-id]/agent-card.json` instead of `/api/.well-known/[agent-id]/agent-card.json`), causing 404 errors.
