---
'@mastra/factory': patch
---

Factory sessions are now prompted to check a side session's claims before repeating or acting on them. The side-sessions notice says reports can be wrong and asks the session to check specific claims (files changed, pushes, CI, review findings) against the pull request first, or to say that a relayed report is unchecked. The notice stays while any side session's reports can still be read, even after those sessions age out of the list. The review tool says to submit only findings checked against the current diff.
