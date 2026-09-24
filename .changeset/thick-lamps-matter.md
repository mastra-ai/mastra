---
'@mastra/factory': minor
---

Added the `factory_review_source` tool for Factory review-role sessions. It returns the Factory session URL that produced the review, the pull-request author, and any linked Linear or Jira issue. The review skills (`factory-review`, `factory-rereview`, `factory-gitlab-review`, `factory-gitlab-rereview`) now require calling this tool before publishing and including its output as a Factory Session section in the review body. This makes misattributed reviews (e.g. a review that lands on the wrong PR, or approves and requests changes at once) traceable back to the exact session that produced them.
