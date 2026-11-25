---
'@mastra/playground-ui': patch
---

Turned off Mona Sans ligatures in `fonts.css`. Letter pairs such as "tt", "ti" and "ff" now look the same everywhere instead of joining in some places and not in others. Code in Commit Mono is unchanged.

If you copy `getComputedStyle(element).font`, browsers now return an empty string for it. Copy `fontFamily`, `fontSize` and `fontWeight` instead.
