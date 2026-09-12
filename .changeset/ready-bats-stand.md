---
'@mastra/playground-ui': patch
---

Removed the built-in minimum width from the Combobox trigger and dropped the call-site `min-w-*` overrides on Select triggers (agents/entities sort, rule-engine field/operator/value selects) so popover triggers size to their content like any other button. Popups keep their minimum widths.
