---
'@mastra/playground-ui': patch
---

Unified the text inside controls. Picked values in `Select`, `Combobox` and `DateTimePicker` now use the same weight as typed values in `Input`, monospace fields such as keys and IDs no longer turn bold, and every field placeholder uses the `placeholder` color and keeps it on focus. Text in monospace fields reads the new `--font-mono-control` property, set by `fonts.css`; if you override `--font-mono`, override it too.
