---
'@mastra/playground-ui': patch
'mastra': patch
---

Hovering a page in a large Knowledge graph no longer lays the whole graph out again: links fetched for a hover are drawn but not counted, and a page's links are found through an index built once.
