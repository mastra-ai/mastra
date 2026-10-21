---
'@mastra/playground-ui': patch
---

Improved icon consistency. Every lucide icon now draws the same line weight for its size, inside buttons and the `Icon` wrapper or not. Custom product icons and brand logos are unchanged.

**Customize the line weight**

Override the `--icon-stroke-width` token (in lucide's 24-unit grid, default `2.25`):

```css
:root {
  --icon-stroke-width: 2;
}
```
