---
'@mastra/factory': patch
---

Side sessions started from a user session can now load the Factory review skills (`factory-review`, `factory-rereview`, `factory-self-review` and the GitLab variants). A user session can start a side session and tell it to review a pull request without the side session being a bound review session. Review skills stay hidden from unbound user sessions and from side sessions bound to another role.
