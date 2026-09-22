---
'@mastra/playground-ui': patch
---

Fixed three classes that resolved to nothing: the checkbox tick rendered at the SVG default stroke width instead of 3.25, the fluid hover highlight's default fill painted nothing, and the observation marker's expanded border was invisible. Foundations now documents which status token a surface wants — a notice pair for a tinted admonition, the standalone ink for a bare line or a dot — and records that the standalone inks clear 8:1 on the dark shell but land near 3:1 on white, so the hue belongs on the icon and the sentence stays on `--foreground`.
