---
'@mastra/factory': patch
---

Fixed git credentials appearing in command lines and remote URLs inside session sandboxes. Clone, fetch, push and pull request creation now receive the token through the process environment only. Branch names git would refuse (`a..b`, `x.lock`, a trailing `/`) are now rejected when saved instead of failing later at checkout.
