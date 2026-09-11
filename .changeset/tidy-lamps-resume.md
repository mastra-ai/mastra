---
'@mastra/inngest': patch
---

Fixed resuming a step that suspended inside a nested workflow. The nested run now uses the parent's run id (with a per-index suffix for foreach iterations), matching the default engine, instead of a random id that was lost when core strips `suspendPayload` from the persisted snapshot; and the delivery pass after the child finishes replays the memoized invoke instead of throwing `No suspended steps found in nested workflow`.
