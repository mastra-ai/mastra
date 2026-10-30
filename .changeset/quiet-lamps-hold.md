---
'@mastra/factory': patch
---

Fixed Factory intake losing or reviving routing in edge cases:

- Issues queued by a factory that was then deleted are now filed by the factory that takes over its source, instead of being lost.
- An issue still claimed by a deleted factory's card is freed when another factory files it.
- Two servers starting at the same time during an upgrade can no longer bring back a source routing that was removed in between.
- Deleting a factory removes it and its intake routing together, so a failed delete keeps both and retrying finishes the job.
- Saving a source routing for a factory while it is being deleted now fails with `factory_project_not_found`, instead of leaving a routing that blocks the factory taking over that source.
