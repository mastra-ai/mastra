---
'@mastra/playground-ui': patch
---

`TextAndIcon` now renders as small muted caption text on its own, instead of taking its size and color from its parent. Outside a styled container it used to fall back to the browser's 16px, which made it look oversized, for example next to a `SideDialog.Heading`. Only icons placed directly inside `TextAndIcon` are resized and dimmed, so provider logos and nested icons keep their own look.

`SideDialog.Top` now renders its text as muted caption, so breadcrumbs and their separators match. If you used `SideDialog.Top` for a plain-text title, wrap the title in `SideDialog.Heading`:

```tsx
// Before
<SideDialog.Top>Edit Skill</SideDialog.Top>

// After
<SideDialog.Top>
  <SideDialog.Heading as="h2">Edit Skill</SideDialog.Heading>
</SideDialog.Top>
```
