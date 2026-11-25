---
'@mastra/pg': patch
---

`pgKnowledgeTransactionClient()` accepts the transaction a `knowledge.getStorage().transaction()` callback receives, so a host's own rows still commit and roll back with its page writes now that core reports those writes to change listeners.
