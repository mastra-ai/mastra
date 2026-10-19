---
'@mastra/playground-ui': patch
---

`DataPanel.Header` now moves its `Metadata` to a second row when the heading, metadata and actions don't fit on one, instead of cutting the metadata off under the actions. The heading and actions stay on the first row and a long ID is shortened first.

In the trace panel's side column, the tabs and "Open full thread" now stay on one row, the tab labels stay visible down to a 400px column, and the "Open full thread" icon is centered when it collapses.
