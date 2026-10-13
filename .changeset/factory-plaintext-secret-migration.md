---
'@mastra/factory': patch
---

Fixed enabling `secretEncryption` on an existing Factory database. Model credentials, custom provider API keys, and integration tokens saved before encryption was turned on now read back correctly and are encrypted in place. Previously, they were encrypted as JSON text, so stored credentials stopped working.
