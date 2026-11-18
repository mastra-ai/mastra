---
'@mastra/playground-ui': patch
---

Settings rows with their control beside the label now keep the same height with or without a description, so a card's rows stay even. A list's first row (`SettingsListHeader`, `SettingsEmptyRow`) is now as tall as those rows too, so "No request headers" lines up with the settings above it. Stacked rows on narrow screens and rows with the control below the label are unchanged. On narrow screens, a `SettingsItem`'s value or actions now sit on their own line under the title, as a `SettingsRow`'s control does, so a long value no longer squeezes the title.
