---
'@mastra/factory': patch
---

Fixed GitHub repository access after the GitHub App was reinstalled more than once. Recovery could pick an older, also-dead installation and save it on the repository, which then broke git access for good. It now tries the newest installations first and only moves the repository to one that can mint a token.
