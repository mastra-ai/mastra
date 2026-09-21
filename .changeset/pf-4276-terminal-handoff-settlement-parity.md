---
'@mastra/core': patch
---

Hardened Harness terminal handoff settlement and recovery.

- Aborting or cancelling a suspended turn now cancels its deferred terminal admission before the pending row clears, so a failure stays recoverable.
- A retried resume probes the admission bound to the run in any status and finishes bookkeeping when the commit sealed but the pending-resume flush failed.
- An adopted duplicate stream runs the durable suspend and token bookkeeping before deferring its commit.
- Retried resume settlement no longer double-accounts the same generation's usage.
- `supportsTerminalHandoff` on the in-memory adapter now honors `terminalHandoff.enabled`, and public terminal operations reject calls when the capability is disabled.
