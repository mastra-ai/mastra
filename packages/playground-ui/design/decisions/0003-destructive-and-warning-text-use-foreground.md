# 0003: Destructive and warning text use their foreground role

**Decision**: text and icons on the plain page use `destructive-foreground` and `warning-foreground`. Success and info text use `success-indicator` and `info-indicator`. Dots, bars, chart marks, and invalid-field borders use `{status}-indicator` for every status.

**Scope**: status-colored text and icons outside a tinted box. Text inside a `Notice`, `Badge`, or other tint uses that tint's `-subtle-foreground`, and only there.

**Why**: the destructive and warning indicator fills are too light to read as text in light mode. An indicator is tuned to be seen as a mark, not read as a word.

**Evidence**: PR [#25587](https://github.com/mastra-ai/mastra/pull/25587), commit `c6dc3fe`: "adds `warning-foreground` and `destructive-foreground` for text, since the warning fill is too light to read as text in light mode." `FieldError` uses `text-destructive-foreground` (`src/ds/components/Field/field.tsx`).

**Supersedes**: the older rule that sends every sentence or icon on the plain page to `{status}-indicator`.

**Approved by**: merged in #25587, 2026-09-30.

**Reaches**: `rg "text-(destructive|warning|success|info)-(indicator|foreground)" packages mastracode`
