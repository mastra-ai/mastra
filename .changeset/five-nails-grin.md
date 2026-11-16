---
'@mastra/playground-ui': patch
---

`SettingsRow` and `SettingsFieldsetRow` now move a control that is too wide to sit beside its label onto the next line, still aligned to the row's right edge, instead of squeezing the label. Put several controls straight in the row (no wrapper `div` or width classes); the row lines them up on the same edge as every other row.
