---
'@mastra/playground-ui': minor
---

Factory boards can now run under any host's routes. Wrap the board in `BoardNavigationProvider` with your app's link component and URL builders; `BoardEmptyStateActions` and `ConfigureBoardButton` read their links from it.
