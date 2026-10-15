---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/sources.css` so an app with its own Tailwind build can pick up every class the components use without pointing at `node_modules`. Import it after the app's own Tailwind entry:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/theme.css';
@import '@mastra/playground-ui/sources.css';
```

Without it, a utility the app's sheet emits can override a responsive variant only the components use, for example `flex-col` beating `sm:flex-row`.
