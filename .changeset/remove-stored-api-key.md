---
'@mastra/code-sdk': patch
---

Added `AuthStorage.removeStoredApiKey(provider)`, the counterpart of `setStoredApiKey()`. It removes the stored key and undoes its environment variable export, so a removed key stops authenticating models right away instead of at the next restart. If the variable held another key before, such as the one the process was started with, that key is restored.
