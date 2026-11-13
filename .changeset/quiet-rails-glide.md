---
'@mastra/playground-ui': minor
---

The shared sidebar now animates its collapse. Rows stay in place and narrow with the sidebar while their text fades, and the icon rail takes over once the width settles; expanding plays it back. Dragging the edge past the collapse point runs the same animation. Collapsing takes 200ms with a snappier curve (`--resize-dur` and `--resize-ease`), and no longer restyles the whole page, so it stays smooth on heavy pages. Sub-menu pages slide a full width, and crossfade with the rail when the sidebar collapses or expands.
