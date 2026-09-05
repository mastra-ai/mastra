---
'@mastra/factory': patch
---

A run waiting for approval is now an item in Needs attention — the inbox, the sidebar popover and the Overview preview all list it, with Run it and Dismiss on the row. Marking everything read clears the badge while the dot keeps saying a run is parked. The separate approval panel is gone. `GET /web/factory/projects/:id/attention` no longer returns `approvalCount`; parked runs arrive as items of kind `automation-proposed`.
