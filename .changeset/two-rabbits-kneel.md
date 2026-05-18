---
'@mastra/playground-ui': patch
---

Removed the unused Entity component (formerly under `Composite/Entity` in Storybook) from the public exports. It was only consumed by the local studio package, so it has been moved internally and is no longer exported from `@mastra/playground-ui`. No replacement is needed for external consumers since no public usage was found.
