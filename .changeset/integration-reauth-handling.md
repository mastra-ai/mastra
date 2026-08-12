---
'@mastra/factory': patch
---

Generalize integration reauth error handling from Linear-specific to any integration. Server routes now return `integration_reauth_required` with integration name and connect path, enabling the SPA to handle reauth for any integration without hardcoded paths.
