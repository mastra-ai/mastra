---
'@mastra/playground-ui': patch
---

`ChatShell.Column` accepts a `ref`, and the shell's track is now the positioning context for overlays that must span the scrolled height, such as a sticky thread rail.
