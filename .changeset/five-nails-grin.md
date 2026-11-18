---
'@mastra/playground-ui': patch
---

`SettingsRow` and `SettingsFieldsetRow` now move controls that are too wide to sit beside their label onto the next line, starting under the label, instead of squeezing the label. Put several controls straight in the row (no wrapper `div` or width classes); beside the label they end on the same right edge as every other row.
