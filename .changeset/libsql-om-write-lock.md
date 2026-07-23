---
'@mastra/libsql': patch
---

Fixed lost writes and transaction contamination in observational-memory buffering by routing all memory-domain mutations through the per-client write lock. Read-modify-write operations (buffered observation appends, config updates, buffered-to-active swaps) now run inside locked write transactions, preventing concurrent autocommit statements from being swept into open interactive transactions.
