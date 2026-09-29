---
'@mastra/playground-ui': minor
---

Added `getShortId` and `getShortSha` to `@mastra/playground-ui/utils/id`. `getShortId` keeps the first 8 characters of an ID, and `getShortSha` keeps the first 7 characters of a commit SHA, like GitHub. `ItemList` and `DataList` ID cells now use `getShortId`. It is still exported from `@mastra/playground-ui/components/Text`.
