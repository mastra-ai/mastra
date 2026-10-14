---
'@mastra/core': patch
---

Fixed workflow step scorers silently not saving scores when the step runs inside a nested workflow that isn't registered on the Mastra instance. Fixes #26790.

Step and agent scorers now save scores with the exact scorer that ran, instead of looking it up again by ID. Previously, a step scorer that shared an ID with a scorer registered on the Mastra instance could be scored with the registered scorer instead of its own.

`mastra.getScorerById()` now prefers a scorer whose `id` matches exactly before falling back to a `name` match, so a scorer whose name equals another scorer's ID can no longer be returned in its place.
