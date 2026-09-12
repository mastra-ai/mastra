---
'@mastra/playground-ui': patch
'@mastra/playground': patch
---

Button: add an `icon` prop. The icon is always rendered on the left of the label, wrapped in `<Icon>`, with a fixed gap, size, opacity and hover transition defined once in `Button`. All icon+label buttons in `@mastra/playground-ui` and `@mastra/playground` now use `icon={...}` instead of composing the icon inside `children`.
