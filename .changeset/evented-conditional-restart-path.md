---
'@mastra/core': patch
---

Fixed restarting an evented workflow that failed inside a conditional (`.branch()`) step. The restart could hang or return the wrong result because the conditional branch was re-run at the wrong position and its output never aggregated back. Restarts of failed conditional branches now resume the correct branch and complete reliably, matching how parallel steps already behaved.
