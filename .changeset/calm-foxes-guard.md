---
'@mastra/core': patch
---

Guard `deepMerge` against prototype-polluting keys. A `__proto__`, `constructor`, or `prototype` key on an untrusted source object (for example one parsed from JSON) is now skipped during the merge, so it can no longer reassign the merged object's prototype chain or shadow its `constructor`. This mirrors the guard already applied by the module's path-setting helper. Legitimate merges are unaffected.
