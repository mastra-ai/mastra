---
'@mastra/playground-ui': patch
---

Studio lists with cells outside the main link/button (agents, datasets, experiments, workflows, inbox, skills) now activate from anywhere on the row: clicking a trailing cell navigates or selects, and keyboard focus lands on the row itself instead of the inner link. Buttons, popovers and expanders inside those rows keep their own behavior without triggering the row.
