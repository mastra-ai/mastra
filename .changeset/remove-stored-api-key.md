---
'@mastra/code-sdk': patch
---

Added `AuthStorage.removeStoredApiKey(provider, envVar)`, the counterpart of `setStoredApiKey()`. It removes the stored key and unsets `envVar` while it still holds that key, so a removed key stops authenticating models right away instead of at the next restart.
