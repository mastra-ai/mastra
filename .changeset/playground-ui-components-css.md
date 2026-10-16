---
'@mastra/playground-ui': minor
---

Added `@mastra/playground-ui/components.css`, the components' stylesheet uncompiled, so an app with its own Tailwind build compiles one sheet instead of loading `style.css` and then its own:

```css
@import 'tailwindcss';
@import '@mastra/playground-ui/components.css';
@import '@mastra/playground-ui/sources.css';
```

The entry carries the tokens from `theme.css`, the `dark` variant, the typography plugin, `tw-animate-css`, and the components' custom utilities, base styles and keyframes, so the `@custom-variant dark` line from the `theme.css` recipe is no longer needed. Keep `sources.css` next to it: it is what makes Tailwind emit the classes the compiled components use. In the first app moved over, the page's CSS went from 102 KB to 61 KB gzipped.

`@tailwindcss/typography` and `tw-animate-css` are now dependencies instead of devDependencies, so the entry resolves them from the installed package. The `time-input` utility loads `/icons/clock.svg` from the app's root; an app that uses it ships that asset.

`style.css` changes in one place: CodeMirror's five `--syntax-*` roles now live in `theme/code.css` on `:root` instead of under `.cm-editor`. Apps without a Tailwind build keep loading it as before.
