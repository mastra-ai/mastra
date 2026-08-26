---
'@mastra/playground-ui': patch
---

Hardened the fix for popups stretching the page: all floating elements now take their fixed positioning from one shared constant, and a test fails if a new component falls back to Base UI's absolute default and could reintroduce the double-scrollbar bug.
