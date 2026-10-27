---
'@mastra/playground-ui': patch
---

The Metrics date picker no longer lets you pick a custom range that starts before the oldest trace your storage still keeps, so cards don't show an empty start that looks like missing data. Metrics cards that fail to load now say when your session expired or you lack permission, and offer a Retry button.
