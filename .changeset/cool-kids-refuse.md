---
'@mastra/playground-ui': minor
---

Added title and caption variants to the Txt component. Each variant carries its full text treatment, so call sites no longer override color or weight with class names.

```tsx
<Txt as="h2" variant="title">Section title</Txt>
<Txt variant="caption">Supporting caption text</Txt>
```

Settings group titles and descriptions now use these variants, which also fixes their text color outside Factory where the previous icon color utilities did not resolve.
