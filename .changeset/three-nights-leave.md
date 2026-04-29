---
'@mastra/editor': patch
---

Fixed template variable interpolation for arrays and objects. Previously, using {{products}} where products is an array of objects would render as [object Object],[object Object]. Now arrays and objects are automatically JSON-stringified, so {{products}} correctly renders the full JSON representation.
