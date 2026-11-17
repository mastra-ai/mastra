---
'@mastra/playground-ui': patch
---

Fixed the right padding of `Sidebar.CommandHeader`: its buttons now line up with the right edge of the nav rows below.

A `Button` rendered as a link no longer puts its `type` on the anchor, so `Sidebar.NavAction` used as a link renders a valid `<a>`.
