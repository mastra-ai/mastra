---
'@mastra/playground-ui': minor
---

Removed design system components and parts that Studio, Factory and Platform never render outside stories and tests.

**Removed**

- Whole components: `DateRangeTimeline`, `PrevNextNav`, `ProductBadge`, `RuleCard`, `RuleLines`, `ScatterPlotChart` and `Truncate`, with their `@mastra/playground-ui/components/*` entries.
- `CommentArrival`, `CommentComposer`, `CommentComposerInput`, `CommentComposerSend`, `CommentEditor` and `CommentQuote`. The comment list parts stay.
- `ComposerHeaderActions`, `ComposerToneLabel` and the `ComposerTone` type.
- `CardIllustration` and its hover emphasis on interactive cards.
- `DrawerProvider`, `DrawerIndent`, `DrawerIndentBackground` and `DrawerSwipeArea`.
- `HeaderAction` and `HeaderGroup`.
- `DateTimeCell` and `EntryCell` from `Table`. `Cell` and `TxtCell` stay.
- `FieldBlocksLayout`, `SelectFieldBlock` and `TextareaFieldBlock`. `FieldBlock` and `TextFieldBlock` stay.
- `ThinkingLevelPicker` and `ThinkingLevelUnavailable`. `ThinkingLevelIcon` and `ThinkingLevelRamp` stay.
- `PlanFile` and `ToolCallTime`.
- `ShadcnAutoFormFieldComponents` from `@mastra/playground-ui/lib/form/auto-form`.
