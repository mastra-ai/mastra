---
'@mastra/factory': patch
---

Fixed Factory reviews being withheld on pull requests opened by GitHub Apps. The review and re-review skills now compare the recorded PR author against the GitHub REST login (`<slug>[bot]`) instead of the `gh pr view` format (`app/<slug>`), so the author cross-check no longer fails for App-authored PRs. A failed lookup or a genuinely different author still blocks publication.
