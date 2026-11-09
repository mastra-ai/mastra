---
'@mastra/factory': patch
---

Fixed Linear issue links pointing at the wrong workspace when an organization connects more than one Linear workspace. The `linear_get_issue` tool no longer advertises a single workspace's link pattern in that case and tells agents to link with the issue's own `url` instead.
