---
'@mastra/playground-ui': patch
---

Fixed DataList trapping the page scroll. Scrolling over a table that doesn't overflow vertically now scrolls the page, and a tall table hands the scroll to the page once it reaches its end. Sideways scrolling still stays inside the table, so a horizontal swipe can't trigger browser back navigation.
