---
'@mastra/core': patch
---

Preserve reasoning block providerMetadata and cryptographic signatures in session run engine thread history, and omit assistant messages that become empty after stripping reasoning to prevent API replay errors.
