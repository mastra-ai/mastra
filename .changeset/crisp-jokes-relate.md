---
'@mastra/playground-ui': patch
---

Added the `WidgetKindCheck` type: the part of a widget kind that validates a view (`kind`, `optionsSchema` and `issues`), without the React parts. `WidgetKind` now extends it, so existing custom kinds keep working unchanged.
