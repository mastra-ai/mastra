---
'@mastra/playground-ui': patch
---

Improved how DataList looks while scrolling:

- Rows now fade into the dark row background at every scrolled edge, including the top, where they fade just below the header instead of being cut off. The header itself no longer fades.
- Scrollbars sit beside the rows, below the header, instead of along the card's edge where its rounded corners clipped them.
- Scrolling no longer bounces the whole list, header included.
- A pinned first column shows a divider once cells scroll under it, and its header cell no longer lets other column titles show through.
- Fixed the header row cutting into the card's border at the top corners.
