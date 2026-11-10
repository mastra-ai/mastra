---
'@mastra/factory': patch
---

Fixed `gh` and `git push` failing with 401 errors partway through long Factory sessions. Factory now swaps in a new GitHub installation token before the old one expires, and a sandbox that reconnects gets a fresh token instead of an expired one. Organization PATs are not changed.
