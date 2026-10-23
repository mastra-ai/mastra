---
'@mastra/playground-ui': minor
---

Icon-only buttons are now circles everywhere. Before, a `Button` holding only an icon with a text size (`sm`, `md`, `lg`) rendered as a padded pill, while others used the round `icon-*` sizes. All built-in icon-only buttons (panel close, previous/next, copy, code section and filter actions) now use `icon-sm`, `icon-md` or `icon-lg`.

`CopyButton` now takes only icon sizes and defaults to `icon-sm`:

```tsx
// Before
<CopyButton content={id} size="sm" />

// After
<CopyButton content={id} />
<CopyButton content={id} size="icon-md" />
```

For your own icon-only buttons, pick the icon size of the same height:

```tsx
// Before: renders as a pill
<Button size="sm" aria-label="Close"><XIcon /></Button>

// After: a circle of the same height
<Button size="icon-sm" aria-label="Close"><XIcon /></Button>
```
