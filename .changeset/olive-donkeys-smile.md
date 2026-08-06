---
'@mastra/memory': patch
---

Fixed observational memory removing Markdown link labels from the observation
context given to agents. Links shared in observations previously collapsed to
bare, unlabelled URLs; their label text is now preserved. Semantic tags are
still stripped and collapsed-item markers behave as before.
