---
'@mastra/core': patch
'mastracode': patch
---

Fixed plan mode so plan submissions use a thread-scoped working plan file, the plan prompt renders the real thread-scoped path, plan-mode edits are restricted to that working file, "Request Changes" stops the run immediately with no trailing model output, and revision diffs only show for the same active plan.
