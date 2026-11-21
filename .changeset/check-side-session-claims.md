---
'@mastra/factory': patch
---

Factory sessions now check a side session's claims before repeating or acting on them. The side-sessions notice says reports can be wrong and asks the session to check specific claims (files changed, pushes, CI, review findings) against the pull request first, or to say a relayed report is unchecked. The review tool says to submit only findings checked against the current diff.
