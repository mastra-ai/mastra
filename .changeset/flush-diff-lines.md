---
'@mastra/playground-ui': patch
---

`CodeDiff` with a file header now shows its lines flush against the header and the card's bottom edge, so stacked diffs in a `CodeDiffList` read like a pull request with no blank band above the first line or below the last. The horizontal scrollbar only takes room when lines overflow, and none on platforms with overlay scrollbars. Diffs without a header keep their padding.
