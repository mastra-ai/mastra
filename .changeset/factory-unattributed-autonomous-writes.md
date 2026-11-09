---
'@mastra/factory': patch
---

Fixed autonomous Factory runs labeling their GitHub and GitLab comments, reviews, and pull requests with a person's name. Writes from rule-triggered runs, such as the review agent's verdict and test report, are no longer marked "Opened by" whoever connected the repository, and pull requests they open are no longer assigned to that person. Writes made during a turn a person started still carry that person's name.
