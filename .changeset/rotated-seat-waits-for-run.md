---
'@mastra/factory': patch
---

Fixed Work board self-review skipping `factory_record_review_verdict`, which meant approved work never opened a pull request. When the builder's run was still live after it moved the card to review, the self-review kickoff was delivered into that run, and that run only had the builder's tools. Factory now waits for any live run on the session's thread to end before kicking off the next role, so the review run starts with its own tools.
