---
'@mastra/core': patch
---

Added an optional `handlesModel` hook to the model gateway interface so a gateway can claim bare provider model IDs (like `__GATEWAY_ANTHROPIC_MODEL_OPUS__`) it is able to authenticate, before routing falls back to the default models.dev catalog. This lets gateways that hold credentials (for example OAuth-backed logins) be selected for auth resolution and availability checks instead of being bypassed.
