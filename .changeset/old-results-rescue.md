---
'@mastra/playground-ui': patch
---

Made `SettingsRow` give select and combobox controls one shared width (16rem) beside the label, so pickers line up across rows without each call site sizing them. A width class on the trigger still overrides it, and stacked rows on small screens keep full-width controls. Added a `SettingsRow` Storybook story.
