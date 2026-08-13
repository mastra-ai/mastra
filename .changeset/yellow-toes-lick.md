---
'@mastra/playground-ui': patch
---

Fixed the composer edge glow so it follows the cursor only when the cursor is actually there. Focusing the composer used to light the moving arc as well, which meant the coloured segment kept sliding around the border while you typed or moved the mouse anywhere on the page. Focus now just brightens the border, and the arc lights on hover.
