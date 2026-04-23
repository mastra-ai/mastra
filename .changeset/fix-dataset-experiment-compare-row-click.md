---
'@mastra/playground-ui': patch
---

Fixed row click behavior in the dataset experiments compare view. Clicking a row while selection mode is active now toggles the row's selection instead of navigating to the experiment. Clicking directly on the checkbox no longer also triggers the row click handler.
