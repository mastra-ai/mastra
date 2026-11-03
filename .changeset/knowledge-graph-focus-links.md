---
'@mastra/playground-ui': patch
'mastra': patch
---

The Knowledge graph now draws every page the focused page links to, and every page whose notes mention it, even when those pages aren't loaded yet. They are fetched by id or `[[ref]]` (up to 20 each way) and drawn as dots close around the focus with the green and orange link lines; only links past that cap are counted as "more".
