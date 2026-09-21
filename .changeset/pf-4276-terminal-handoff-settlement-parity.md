---
'@mastra/core': patch
'@mastra/pg': patch
---

Hardened Harness terminal handoff settlement and adapter parity: abort and session cancellation now cancel a suspended turn's deferred terminal admission before the pending row clears so a failure stays recoverable, a retried resume probes the admission by run in any status and finishes bookkeeping when the commit sealed but the pending-resume flush failed, an adopted duplicate stream runs the durable suspend/token bookkeeping before deferring its commit, retried resume settlement no longer double-accounts the same generation's usage, and `supportsTerminalHandoff` plus the public terminal operations on both the in-memory and Postgres adapters now honor `terminalHandoff.enabled` while cleanup/fence paths stay callable for recovery.
