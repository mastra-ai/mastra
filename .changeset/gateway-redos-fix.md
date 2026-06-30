---
'@mastra/core': patch
---

Fix a polynomial ReDoS in the model gateway error matcher. The `Missing .+ environment variable` pattern used to classify expected missing-auth errors could backtrack catastrophically on adversarial error messages; it now uses `Missing [^ ]+ environment variable`, which matches the same real messages without the ambiguous overlap.
