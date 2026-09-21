---
'@internal/playground': patch
---

Fixed the Studio frame losing its rim and shadow on the sidebar side. The frame lives inside a resizable panel, and `react-resizable-panels` hardcodes `overflow: hidden`/`auto` inline on the group and panel elements, which clipped the shadow at the panel edge. The Studio panel group and frame panel now opt out of that clip, so the frame keeps its full elevation without changing any spacing — the frame already clips its own content.
