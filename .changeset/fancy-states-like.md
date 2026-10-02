---
'@mastra/playground-ui': minor
---

Added shared headline, introduction, and section-label text roles. Txt and text-bearing controls accept font and role props so applications can format identifiers and commands without overriding typography classes.

Replace `<Txt variant="caption" className="font-mono">run_123</Txt>` with `<Txt variant="caption" font="mono">run_123</Txt>`. Command fields can use `<Input font="mono" textVariant="caption" />`, and prose editors can use `<CodeEditor font="body" />`.
