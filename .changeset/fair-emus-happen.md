---
'@mastra/factory': patch
---

Fixed Factory reviews posting a verdict that contradicts their review text. Factory now rejects a review whose `Verdict:` line does not match the approve or request-changes choice. It also rejects a review whose `Reviewed head:` is not the current pull request head. A review written for an earlier commit can no longer be posted on a newer one.
