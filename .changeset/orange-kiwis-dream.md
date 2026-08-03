---
'@mastra/factory': minor
---

Improved stage transitions to complete immediately. Transitions from intake to triage, planning, or review now return right away, with skill activation happening asynchronously in the background instead of blocking the transition.
