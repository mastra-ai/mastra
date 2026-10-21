---
'@mastra/core': patch
---

Fixed live DurableAgent observers attaching to runs owned by a different agent ID while preserving same-ID observation. Prepared runs now retain the DurableAgent's effective ID and name so ownership remains consistent after a restart.
