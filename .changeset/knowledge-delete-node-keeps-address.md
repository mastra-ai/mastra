---
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed `deleteNodeByAddress` removing a node's address even when it kept the node. If other addresses or records still kept the node alive, the call returned `{ deleted: false }` but had already unbound the address, leaving the node unreachable from the source that imported it. The address is now removed only when the node is actually deleted. Static importers still release their binding when curated content keeps a node alive.
