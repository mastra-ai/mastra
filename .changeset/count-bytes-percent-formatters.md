---
'@mastra/playground-ui': minor
---

Added three formatters so apps stop hand-rolling them:

- `formatBytes` from `@mastra/playground-ui/utils/number`: `formatBytes(1536)` returns `1.5 KB`.
- `formatPercent` from `@mastra/playground-ui/utils/number`: `formatPercent(0.42)` returns `42%`, tiny ratios show `<0.1%`, and `{ signed: true }` returns `+12.3%` for changes.
- `pluralize` from `@mastra/playground-ui/utils/string`: `pluralize(3, 'entry', 'entries')` returns `3 entries`.
