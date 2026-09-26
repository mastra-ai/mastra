---
'@mastra/playground-ui': patch
---

Fixed page content scrolling flush against the filters in `PageLayout`'s action row. The gap below the action row now stays put while the body scrolls, so rows no longer clip right under the filter chips.
