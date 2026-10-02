---
'@mastra/playground-ui': major
---

Added shared headline, introduction, and section-label text roles. Txt and text-bearing controls accept font and role props so applications can format identifiers and commands without overriding typography classes.

Replace `<Txt variant="caption" className="font-mono">run_123</Txt>` with `<Txt variant="caption" font="mono">run_123</Txt>`. Command fields can use `<Input font="mono" textVariant="caption" />`, and prose editors can use `<CodeEditor font="body" />`.

Txt now accepts only text elements. Migrate existing `<Txt as="div" variant="body">Content</Txt>` usages to `<div><Txt variant="body">Content</Txt></div>` (or an inline `Txt as="span"` when appropriate). Buttons and links own their native/shared markup and wrap their label in Txt; Txt does not expose a `render` prop.
