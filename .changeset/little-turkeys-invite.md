---
'@mastra/factory': patch
---

Slow workspace opens can now be diagnosed directly from server logs. Added `[factory:timing]` log lines for each phase of the sandbox session-open path — `sandbox.reattach`, `sandbox.provision`, `workspace.materialize`, and `workspace.checkout` — so you can see exactly which phase is slow instead of reconstructing timings by hand.
