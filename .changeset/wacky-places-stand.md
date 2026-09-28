---
'@mastra/playground-ui': patch
---

`TextAndIcon` now renders as small muted caption text on its own, instead of taking its size and color from its parent. Outside a styled container it used to fall back to the browser's 16px, which made it look oversized, for example next to a `SideDialog.Heading`. Breadcrumbs inside `SideDialog.Top` keep the bar's body size. Only icons placed directly inside `TextAndIcon` are resized and dimmed, so provider logos and nested icons keep their own look.
