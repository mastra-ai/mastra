---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/fonts.css`, which loads Mastra's product fonts, Mona Sans for text and Commit Mono for code, and points the font tokens at them. Import it next to the package's other stylesheets instead of bundling font files in each app:

```css
@import '@mastra/playground-ui/fonts.css';
```

Fonts load as woff2 split by script, so a page only downloads the characters it renders.
