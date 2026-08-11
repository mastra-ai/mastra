---
'@mastra/playground-ui': patch
---

Sidebar nav rows now place their trailing action in the layout flow instead of overlaying the row. A row with an `action` renders as a flex pair — label then action — so the action can never sit on top of the label, and hover/active backgrounds paint the whole row including the action.
