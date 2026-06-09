---
'@mastra/playground-ui': minor
---

Added a new `@mastra/playground-ui/theme.css` export and made the Mastra brand green a built-in color.

**New theme.css export**

You can now import the design tokens as raw CSS:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/theme.css'; /* design tokens */
@import '@mastra/playground-ui/style.css'; /* component styles */
```

Before, apps had to copy every token into their own `@theme` block so Tailwind would generate the matching utility classes (like `bg-surface1` or `text-neutral4`). Now your app's Tailwind reads the tokens from this file directly. This is the same pattern as `tailwindcss/theme.css`, and it keeps the tokens defined in one place.

**Brand green and chart colors**

The `green-*` classes now use the Mastra brand green (in both light and dark mode) instead of Tailwind's default green. New `--chart-1` through `--chart-5` colors are also available for charts. If you used the stock Tailwind green before, the new green looks a bit more vivid.
