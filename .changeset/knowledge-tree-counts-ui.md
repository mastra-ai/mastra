---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge explorer tree is easier to use on large knowledge bases:

- Each page with children shows how many sit under it, and only those pages show an expand arrow. Pages with no children no longer show an arrow that vanishes when clicked.
- Clicking a page with children opens it, loading its children, and highlights it.
- Clicking a page the graph didn't load opens it as a page, instead of selecting it in a graph that can't show it.
