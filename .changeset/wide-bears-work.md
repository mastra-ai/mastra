---
'@mastra/core': patch
---

Fixed `.branch()` condition receiving `undefined` inputData when resuming a suspended nested workflow after `.map()`.

Previously, when a workflow used `.map()` followed by `.branch()` and a nested workflow inside the branch called `suspend()`, resuming would fail with `TypeError: Cannot read properties of undefined` because the branch conditions were unnecessarily re-evaluated with stale data.

Resume now skips condition re-evaluation for `.branch()` entries and goes directly to the correct suspended branch, matching the existing behavior for `.parallel()` entries.

Fixes #12982
