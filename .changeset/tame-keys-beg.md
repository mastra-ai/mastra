---
'@mastra/playground-ui': patch
---

Fixed field labels catching clicks across the whole row. Clicking the empty space beside a text label no longer focuses its field; only the label text does. Labels that wrap a checkbox, switch or radio still toggle it from anywhere in the row.
