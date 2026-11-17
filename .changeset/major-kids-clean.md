---
'@mastra/playground-ui': patch
---

Fixed section titles (`SettingsTitle`, `SettingsDescription`) sitting 10px to the right of everything around them outside settings pages, such as field labels on Platform's create project forms and page titles on billing. Outside a `SettingsLayout`, section titles now line up with the page's left edge. Section titles also use the same primary color as field labels everywhere, settings pages included; on settings pages they keep their inset, in line with the inset page title.
