---
'@mastra/factory': patch
---

Fixed Factory reviews posting a verdict that contradicts their review text. Factory now rejects a review whose `Verdict:` line does not match the approve or request-changes choice, or whose `Reviewed head:` is not the current pull request head, and review skills write each review to a file named after the reviewed commit so an earlier pass's review can no longer be reposted.
