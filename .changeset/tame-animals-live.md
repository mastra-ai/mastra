---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/sources.css` so an app with its own Tailwind build can pick up every class the components use without pointing at `node_modules`. Import it after the app's own Tailwind entry:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/theme.css';
@import '@mastra/playground-ui/sources.css';

@custom-variant dark (&:is(.dark *));
```

Without `sources.css`, a utility the app's sheet emits can override a responsive variant only the components use, for example `flex-col` beating `sm:flex-row`.

Keep the `dark` variant line: the components switch to dark mode on a `.dark` ancestor. Without it, Tailwind applies their `dark:` styles whenever the operating system is in dark mode, even in a light-themed app.
