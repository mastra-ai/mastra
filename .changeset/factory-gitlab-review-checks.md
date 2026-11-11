---
'@mastra/factory': patch
'mastra': patch
---

Fixed a GitLab merge request reviewer being refused when it published test checks: the reviewer is now bound to the merge request's number instead of digits read from its encoded id.
