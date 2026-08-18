---
'@mastra/client-js': patch
---

Add an SDK ↔ server contract audit that validates every public client method's request against the server's Zod route schemas, with a snapshot-based ratchet test so newly introduced drift fails CI. Documents how to run and re-record the audit in the package README. No runtime behavior change.
