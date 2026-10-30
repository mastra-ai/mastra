---
'@mastra/factory': patch
---

Fixed Factory intake losing or reviving routing in edge cases:

- Issues queued by a factory that was then deleted are now filed by the factory that takes over its source, instead of being lost.
- An issue still claimed by a deleted factory's card is freed when another factory files it.
- Two servers starting at the same time during an upgrade can no longer bring back a source routing that was removed in between.
- If clearing a factory's intake routing fails during delete, the factory is kept, so retrying the delete finishes the job.
