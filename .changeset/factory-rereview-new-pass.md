---
'@mastra/factory': patch
---

Fixed Factory re-reviews that could repeat the previous verdict without looking at newly pushed commits. A re-review's opening prompt now states that it is a new pass, names the head the previous pass reviewed, and requires checking the live head and the commits since before giving a verdict.
